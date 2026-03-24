import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Bucket = { count: number; resetAt: number };

/** In-memory fallback (per server instance). Used when Upstash is not configured. */
const buckets = new Map<string, Bucket>();

const MAX_BUCKETS = 50_000;

function pruneIfNeeded() {
  if (buckets.size <= MAX_BUCKETS) return;
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now > b.resetAt) buckets.delete(k);
  }
}

function checkRateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; remaining: number } {
  pruneIfNeeded();
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0 };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count };
}

const upstashCache = new Map<
  string,
  { limit: (key: string) => Promise<{ success: boolean; remaining: number }> }
>();

function getUpstashRatelimit(
  limit: number,
  windowMs: number
): { limit: (key: string) => Promise<{ success: boolean; remaining: number }> } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const cacheKey = `${limit}:${windowMs}`;
  let rl = upstashCache.get(cacheKey);
  if (!rl) {
    const instance = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.fixedWindow(limit, `${Math.ceil(windowMs / 1000)} s`),
    });
    rl = {
      limit: (k: string) =>
        instance.limit(k).then((r: { success: boolean; remaining: number }) => ({
          success: r.success,
          remaining: r.remaining,
        })),
    };
    upstashCache.set(cacheKey, rl);
  }
  return rl;
}

/**
 * Fixed window rate limit. Returns ok=false when limit exceeded.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set;
 * otherwise falls back to in-memory (per instance, suitable for dev/single-instance).
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; remaining: number }> {
  const rl = getUpstashRatelimit(limit, windowMs);
  if (rl) {
    const result = await rl.limit(key);
    return {
      ok: result.success,
      remaining: result.remaining,
    };
  }
  return checkRateLimitInMemory(key, limit, windowMs);
}

export function rateLimitKeyFromRequest(
  request: NextRequest,
  prefix: string
): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}`;
}
