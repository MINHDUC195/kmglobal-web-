/**
 * Tính trạng thái khóa học từ ngày tháng (không dùng cột status).
 * - Sắp mở: trước ngày mở đăng ký
 * - Đang mở đăng ký: trong thời gian đăng ký
 * - Đã đóng đăng ký: sau ngày đóng đăng ký
 * - Đã kết thúc: sau ngày kết thúc khóa
 */

export type CourseDisplayStatus = "sắp mở" | "đang mở đăng ký" | "đã đóng đăng ký" | "đã kết thúc";

export function getCourseDisplayStatus(
  registrationOpenAt: string | null,
  registrationCloseAt: string | null,
  courseEndAt: string | null,
  now: Date = new Date()
): CourseDisplayStatus {
  const n = now.getTime();
  const openAt = registrationOpenAt ? new Date(registrationOpenAt).getTime() : null;
  const closeAt = registrationCloseAt ? new Date(registrationCloseAt).getTime() : null;
  const endAt = courseEndAt ? new Date(courseEndAt).getTime() : null;

  if (endAt != null && n > endAt) return "đã kết thúc";
  if (closeAt != null && n > closeAt) return "đã đóng đăng ký";
  if (openAt != null && n < openAt) return "sắp mở";
  return "đang mở đăng ký";
}

/** Khóa có hiển thị trên trang khám phá (sắp mở hoặc đang mở) */
export function isCourseVisibleOnExplore(
  registrationCloseAt: string | null,
  courseEndAt: string | null,
  now: Date = new Date()
): boolean {
  const n = now.getTime();
  const closeAt = registrationCloseAt ? new Date(registrationCloseAt).getTime() : null;
  const endAt = courseEndAt ? new Date(courseEndAt).getTime() : null;
  if (closeAt != null && n > closeAt) return false;
  if (endAt != null && n > endAt) return false;
  return true;
}
