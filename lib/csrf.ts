import type { NextRequest } from "next/server";

function getAllowedOrigin(): string | null {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!siteUrl) return null;
  try {
    return new URL(siteUrl).origin;
  } catch {
    return null;
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
  const allowed = getAllowedOrigin();

  if (!allowed) return true; // No base URL configured, skip check

  // Origin takes precedence - must match if present
  if (origin) {
    try {
      return new URL(origin).origin === allowed;
    } catch {
      return false;
    }
  }

  // No Origin: check Referer when present
  if (referer) {
    try {
      return new URL(referer).origin === allowed;
    } catch {
      return false;
    }
  }

  // Đã cấu hình site URL: từ chối khi không có Origin và Referer (giảm CSRF)
  return false;
}
