export type StudentProfileCompletionRow = {
  role?: string | null;
  /** false = học viên đã có trước khi bật gate, không bắt buộc cập nhật hồ sơ chi tiết */
  profile_completion_required?: boolean | null;
  full_name?: string | null;
  address_street_number?: string | null;
  address_street_name?: string | null;
  address_ward?: string | null;
  address_province?: string | null;
  phone?: string | null;
  data_sharing_consent_at?: string | null;
} | null;

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
  if (!profile.data_sharing_consent_at) return true;
  return false;
}
