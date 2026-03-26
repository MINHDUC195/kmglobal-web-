import type { StudentProfileCompletionRow } from "../types/domain/student-profile";

export type { StudentProfileCompletionRow };

/**
 * Học viên phải hoàn tất khi profile_completion_required === true (mặc định với tài khoản mới).
 * Địa chỉ chi tiết (đường, phường/xã, tỉnh/tp) là tùy chọn; bắt buộc: họ tên, SĐT, đồng ý dữ liệu.
 */
export function studentProfileNeedsCompletion(profile: StudentProfileCompletionRow): boolean {
  if (!profile) return true;
  if (profile.role !== "student") return false;
  if (profile.profile_completion_required === false) return false;
  if (!profile.full_name?.trim()) return true;
  if (!profile.phone?.trim()) return true;
  const hasConsent = Boolean(profile.data_sharing_consent_at) || profile.security_signed === true;
  if (!hasConsent) return true;
  return false;
}
