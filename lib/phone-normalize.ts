import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Chuẩn hóa SĐT sang E.164 (so trùng sau đầu số quốc tế).
 * Mặc định vùng VN: 090…, 84…, +84…, 9 chữ số di động → cùng một E.164.
 */
export function normalizePhoneToE164(input: string | null | undefined): string | null {
  if (input == null) return null;
  const s = String(input).trim();
  if (!s) return null;
  const n = parsePhoneNumberFromString(s, "VN");
  if (!n?.isValid()) return null;
  return n.format("E.164");
}

export function isValidPhoneInput(input: string | null | undefined): boolean {
  return normalizePhoneToE164(input) != null;
}

/** Thông báo khi DB/unique chặn trùng SĐT */
export const PHONE_IN_USE_MESSAGE = "Số điện thoại đã được sử dụng bởi tài khoản khác.";

export function isPhoneUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "23505") return true;
  const m = err.message ?? "";
  return /phone_e164|duplicate key|unique constraint|already exists/i.test(m);
}
