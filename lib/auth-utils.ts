/**
 * Auth utilities - chống đăng nhập trùng IP, cập nhật last_ip/last_session.
 * Cần gọi từ Server Action hoặc API route để lấy IP từ headers.
 */

export function getClientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  return null;
}
