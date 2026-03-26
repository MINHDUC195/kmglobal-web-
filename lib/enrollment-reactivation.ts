/**
 * Quy tắc đăng ký lại sau khi hủy: cùng regular_course, giữ tiến độ khi
 * cancel_count < 5, khóa chưa kết thúc (course_end_at), cửa sổ đăng ký còn hiệu lực.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

type ReactivationBlockReason =
  | "too_many_cancels"
  | "course_ended"
  | "registration_closed"
  | "registration_not_open";

async function getCancelCountForCourse(
  admin: SupabaseClient,
  userId: string,
  regularCourseId: string
): Promise<number> {
  const { data } = await admin
    .from("enrollment_cancel_stats")
    .select("cancel_count")
    .eq("user_id", userId)
    .eq("regular_course_id", regularCourseId)
    .maybeSingle();
  return (data as { cancel_count?: number } | null)?.cancel_count ?? 0;
}

export async function canReactivateCanceledEnrollment(
  admin: SupabaseClient,
  userId: string,
  regularCourseId: string,
  now: Date = new Date()
): Promise<{ ok: true } | { ok: false; reason: ReactivationBlockReason; message: string }> {
  const count = await getCancelCountForCourse(admin, userId, regularCourseId);
  if (count >= 5) {
    return {
      ok: false,
      reason: "too_many_cancels",
      message:
        "Bạn đã hủy đăng ký khóa này 5 lần. Không thể đăng ký lại cùng khóa này. Vui lòng liên hệ hỗ trợ nếu cần.",
    };
  }

  const { data: course, error } = await admin
    .from("regular_courses")
    .select("registration_open_at, registration_close_at, course_end_at")
    .eq("id", regularCourseId)
    .single();

  if (error || !course) {
    return {
      ok: false,
      reason: "course_ended",
      message: "Không tìm thấy khóa học.",
    };
  }

  const c = course as {
    registration_open_at?: string | null;
    registration_close_at?: string | null;
    course_end_at?: string | null;
  };

  const endAt = c.course_end_at ? new Date(c.course_end_at) : null;
  if (endAt && now > endAt) {
    return {
      ok: false,
      reason: "course_ended",
      message: "Khóa học đã kết thúc. Bạn không thể đăng ký lại cùng lớp này.",
    };
  }

  const openAt = c.registration_open_at ? new Date(c.registration_open_at) : null;
  const closeAt = c.registration_close_at ? new Date(c.registration_close_at) : null;
  if (openAt && now < openAt) {
    return {
      ok: false,
      reason: "registration_not_open",
      message: "Khóa học chưa mở đăng ký.",
    };
  }
  if (closeAt && now > closeAt) {
    return {
      ok: false,
      reason: "registration_closed",
      message: "Đã hết hạn đăng ký cho khóa này.",
    };
  }

  return { ok: true };
}
