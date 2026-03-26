/**
 * Hàng / partial row dùng cho gate hoàn tất hồ sơ học viên (`studentProfileNeedsCompletion`).
 * Các field optional vì nhiều query chỉ select một phần cột.
 */
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
  security_signed?: boolean | null;
  data_sharing_consent_at?: string | null;
} | null;
