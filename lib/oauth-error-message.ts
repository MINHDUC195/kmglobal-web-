/**
 * Chuẩn hóa thông báo lỗi OAuth từ Supabase cho người dùng / admin.
 */
export function formatOAuthClientError(raw: string): string {
  const t = raw.trim();
  if (/provider is not enabled|Unsupported provider/i.test(t)) {
    return "Đăng nhập bên thứ ba chưa được bật trên máy chủ xác thực (Supabase). Quản trị viên cần vào Supabase Dashboard → Authentication → Providers, bật Google/Apple/Microsoft và cấu hình Client ID/Secret (hoặc tương đương).";
  }
  return t;
}
