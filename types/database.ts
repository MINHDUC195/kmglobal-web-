/**
 * KM Global - Database types (Clean Slate)
 * Chỉ chứa schema mặc định cho bảng profiles (Auth).
 */

export type UserRole = "owner" | "admin" | "student";

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
