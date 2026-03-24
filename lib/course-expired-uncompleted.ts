import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Kiểm tra: khóa học đã đóng (course_end_at đã qua) VÀ học viên chưa có chứng chỉ.
 * Khi đúng → chặn thi cuối, làm bài tập, xem đáp án. Vẫn cho xem nội dung.
 */
export async function isCourseExpiredUncompleted(
  admin: SupabaseClient,
  enrollmentId: string
): Promise<boolean> {
  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id, regular_course_id")
    .eq("id", enrollmentId)
    .eq("status", "active")
    .single();

  if (!enrollment?.regular_course_id) return false;

  const { data: rc } = await admin
    .from("regular_courses")
    .select("course_end_at")
    .eq("id", enrollment.regular_course_id)
    .single();

  const courseEndAt = rc?.course_end_at;
  if (!courseEndAt) return false;

  const now = new Date();
  if (new Date(courseEndAt) >= now) return false;

  const { data: cert } = await admin
    .from("certificates")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  return !cert;
}
