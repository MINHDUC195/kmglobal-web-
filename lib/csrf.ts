import type { NextRequest } from "next/server";

/** Hostnames where we do not add a www / apex alias (dev, IP, etc.). */
function isLocalOrIpHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return true;
  if (hostname.startsWith("[") && hostname.includes("]")) return true;
  return false;
}

function addUrlAndWwwTwin(siteUrl: string, origins: Set<string>) {
  const trimmed = siteUrl.trim();
  if (!trimmed) return;
  try {
    const u = new URL(trimmed);
    origins.add(u.origin);
    const host = u.hostname;
    if (!isLocalOrIpHost(host)) {
      const twin = new URL(trimmed);
      if (host.startsWith("www.")) {
        twin.hostname = host.slice(4);
      } else {
        twin.hostname = `www.${host}`;
      }
      origins.add(twin.origin);
    }
  } catch {
    /* ignore invalid env */
  }
}

/**
 * Origins allowed for CSRF checks: configured site URL(s), optional www/apex twin,
 * and the Vercel deployment URL when VERCEL_URL is set (production + preview).
 */
function getAllowedOrigins(): string[] {
  const origins = new Set<string>();

  const rawList = [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_APP_URL]
    .filter(Boolean)
    .flatMap((s) => String(s).split(","))
    .map((s) => s.trim())
    .filter(Boolean);

  for (const raw of rawList) {
    addUrlAndWwwTwin(raw, origins);
  }

  if (process.env.VERCEL_URL) {
    try {
      origins.add(new URL(`https://${process.env.VERCEL_URL}`).origin);
    } catch {
      /* ignore */
    }
  }

  return [...origins];
}

function originMatchesAllowed(requestOrigin: string, allowed: string[]): boolean {
  try {
    const o = new URL(requestOrigin).origin;
    return allowed.includes(o);
  } catch {
    return false;
  }
}

/**
 * Validates request Origin/Referer for CSRF defense.
 * Used for state-changing API routes (checkout, enroll, etc).
 * Returns false when Origin/Referer is present and does not match allowed origin.
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const allowed = getAllowedOrigins();

  // Production: bắt buộc cấu hình NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL — không thì CSRF coi như tắt.
  if (allowed.length === 0) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  }

  if (origin) {
    return originMatchesAllowed(origin, allowed);
  }

  if (referer) {
    try {
      return originMatchesAllowed(new URL(referer).origin, allowed);
    } catch {
      return false;
    }
  }

  // Một số trình duyệt / mạng không gửi Origin (và đôi khi Referer) cho POST cùng origin.
  // URL nhận trên server (Host) vẫn phản ánh domain thật — dùng làm fallback an toàn khi đã có session.
  try {
    const requestOrigin = request.nextUrl.origin;
    if (originMatchesAllowed(requestOrigin, allowed)) {
      return true;
    }
  } catch {
    /* ignore */
  }

  return false;
}
