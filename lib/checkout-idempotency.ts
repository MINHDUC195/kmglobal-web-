/**
 * Checkout idempotency: shared across instances when Upstash Redis is configured.
 */

const TTL_SEC = 300;
const KEY_PREFIX = "checkout:idem:";

type IdemPayload = { redirectUrl: string; paymentId: string };

const memory = new Map<string, { payload: string; expiresAt: number }>();

function pruneMemory() {
  const now = Date.now();
  for (const [k, v] of memory) {
    if (now > v.expiresAt) memory.delete(k);
  }
}

export async function getCheckoutIdempotency(
  key: string
): Promise<IdemPayload | null> {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = Redis.fromEnv();
      const raw = await redis.get<string>(`${KEY_PREFIX}${key}`);
      if (raw && typeof raw === "string") {
        return JSON.parse(raw) as IdemPayload;
      }
    } catch (e) {
      console.error("[checkout-idempotency] redis get", e);
    }
  }
  pruneMemory();
  const row = memory.get(key);
  if (row && Date.now() < row.expiresAt) {
    return JSON.parse(row.payload) as IdemPayload;
  }
  return null;
}

export async function setCheckoutIdempotency(
  key: string,
  data: IdemPayload
): Promise<void> {
  const payload = JSON.stringify(data);
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = Redis.fromEnv();
      await redis.set(`${KEY_PREFIX}${key}`, payload, { ex: TTL_SEC });
      return;
    } catch (e) {
      console.error("[checkout-idempotency] redis set", e);
    }
  }
  pruneMemory();
  memory.set(key, {
    payload,
    expiresAt: Date.now() + TTL_SEC * 1000,
  });
}
