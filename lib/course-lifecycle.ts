/**
 * Khóa đang trong thời gian học (giữa course_start và course_end khi có đủ mốc).
 */
export function isCourseInLearningPeriod(
  courseStartAt: string | null,
  courseEndAt: string | null,
  now: Date = new Date()
): boolean {
  const t = now.getTime();
  const start = courseStartAt ? new Date(courseStartAt).getTime() : null;
  const end = courseEndAt ? new Date(courseEndAt).getTime() : null;

  if (start != null && t < start) return false;
  if (end != null && t > end) return false;
  if (start != null && end != null) return t >= start && t <= end;
  if (start != null && end == null) return t >= start;
  if (start == null && end != null) return t <= end;
  return false;
}

export type RegularCourseListFilter = "all" | "registration" | "learning" | "ended";

/**
 * Số ngày còn lại đến targetDate. Trả về null nếu không có ngày hoặc đã qua.
 */
export function daysUntil(
  targetDate: string | null,
  now: Date = new Date()
): number | null {
  if (!targetDate) return null;
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const n = new Date(now);
  n.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - n.getTime()) / (24 * 60 * 60 * 1000));
  return diff < 0 ? null : diff;
}
