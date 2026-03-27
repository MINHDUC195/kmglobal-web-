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

function getRuntimeOriginsFromRequest(request: NextRequest): string[] {
  const origins = new Set<string>();
  const proto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");

  if (proto && forwardedHost) {
    try {
      origins.add(new URL(`${proto}://${forwardedHost}`).origin);
    } catch {
      /* ignore */
    }
  }
  if (host) {
    try {
      const fallbackProto = proto || (process.env.NODE_ENV === "production" ? "https" : "http");
      origins.add(new URL(`${fallbackProto}://${host}`).origin);
    } catch {
      /* ignore */
    }
  }
  try {
    origins.add(request.nextUrl.origin);
  } catch {
    /* ignore */
  }

  return [...origins];
}

/**
 * Validates request Origin/Referer for CSRF defense.
 * Used for state-changing API routes (checkout, enroll, etc).
 * Returns false when Origin/Referer is present and does not match allowed origin.
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const allowed = [...new Set([...getAllowedOrigins(), ...getRuntimeOriginsFromRequest(request)])];

  // Production: bắt buộc cấu hình NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL — không thì CSRF coi như tắt.
  if (allowed.length === 0) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  }

  if (origin) {
    if (originMatchesAllowed(origin, allowed)) {
      return true;
    }
    const secFetchSite = request.headers.get("sec-fetch-site");
    if (secFetchSite === "same-origin") {
      return true;
    }
    return false;
  }

  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (originMatchesAllowed(refererOrigin, allowed)) {
        return true;
      }
    } catch {
      return false;
    }
    const secFetchSite = request.headers.get("sec-fetch-site");
    if (secFetchSite === "same-origin") {
      return true;
    }
    return false;
  }

  /** Không có Origin/Referer — thử tín hiệu từ trình duyệt. */
  const secFetchSiteNoOrigin = request.headers.get("sec-fetch-site");
  if (secFetchSiteNoOrigin === "same-origin") {
    return true;
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
