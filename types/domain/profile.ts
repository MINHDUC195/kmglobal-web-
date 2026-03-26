/**
 * Domain types cho bảng `profiles` và các subset dùng trong query cụ thể.
 * Khớp migration Supabase; khi thêm cột trong DB, cập nhật tại đây (hoặc regenerate types ở Phase 2).
 */

export type UserRole = "owner" | "admin" | "student";

/** Hàng profiles đầy đủ (ước lượng theo schema app đang dùng). */
export interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  address: string | null;
  company: string | null;
  phone: string | null;
  gender: "male" | "female" | "other" | null;
  avatar_url: string | null;
  last_ip: string | null;
  last_session_id: string | null;
  security_signed: boolean;
  created_at: string;
}

/**
 * Cột trả về từ query trong `completeLoginRedirect`
 * (.select security_signed, role, full_name, address_*, phone, data_sharing_consent_at).
 * Đích redirect mặc định (khi không có `?to=` hợp lệ khác `/`): xem `defaultPostLoginPathForRole` trong `lib/complete-login-redirect.ts`.
 */
export interface ProfileRowForLoginRedirect {
  security_signed: boolean;
  role: UserRole | string;
  full_name: string | null;
  address_street_number: string | null;
  address_street_name: string | null;
  address_ward: string | null;
  phone: string | null;
  data_sharing_consent_at: string | null;
}

/** Subset dùng ở header (full_name + role). */
export type ProfileHeaderSnippet = Pick<ProfileRow, "full_name" | "role">;
