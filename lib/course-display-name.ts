/**
 * Bỏ hậu tố Rev (Rev1, Rev2...) khỏi tên hiển thị cho học viên chưa đăng ký.
 * Ví dụ: "Khóa ABC - Rev2" -> "Khóa ABC"
 */
const REV_PATTERN = /\s*[-–]\s*(?:Cải tiến\s+)?Rev\d+\s*$/i;

export function stripRevSuffix(name: string | null | undefined): string {
  if (typeof name !== "string" || !name.trim()) return "";
  return name.replace(REV_PATTERN, "").trim() || name.trim();
}
