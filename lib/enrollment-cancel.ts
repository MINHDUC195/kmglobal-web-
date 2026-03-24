/**
 * Hủy đăng ký: đếm lần hủy, xóa dữ liệu học khi lần 5 + đã thanh toán.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function paymentIsCompleted(
  admin: SupabaseClient,
  paymentId: string | null
): Promise<boolean> {
  if (!paymentId) return false;
  const { data } = await admin
    .from("payments")
    .select("status")
    .eq("id", paymentId)
    .single();
  return (data as { status?: string } | null)?.status === "completed";
}

export async function incrementEnrollmentCancelCount(
  admin: SupabaseClient,
  userId: string,
  regularCourseId: string
): Promise<number> {
  const { data: row } = await admin
    .from("enrollment_cancel_stats")
    .select("cancel_count")
    .eq("user_id", userId)
    .eq("regular_course_id", regularCourseId)
    .maybeSingle();

  const prev = (row as { cancel_count?: number } | null)?.cancel_count ?? 0;
  const next = prev + 1;

  const { error } = await admin.from("enrollment_cancel_stats").upsert(
    {
      user_id: userId,
      regular_course_id: regularCourseId,
      cancel_count: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,regular_course_id", ignoreDuplicates: false }
  );

  if (error) {
    console.error("incrementEnrollmentCancelCount:", error);
    throw new Error("cancel_stats_failed");
  }

  return next;
}

export async function deleteLearningDataForEnrollment(
  admin: SupabaseClient,
  userId: string,
  enrollmentId: string,
  baseCourseId: string
): Promise<void> {
  await admin.from("lesson_progress").delete().eq("enrollment_id", enrollmentId);
  await admin.from("final_exam_attempts").delete().eq("enrollment_id", enrollmentId);
  await admin.from("certificates").delete().eq("enrollment_id", enrollmentId);

  const { data: chapters } = await admin
    .from("chapters")
    .select("id")
    .eq("base_course_id", baseCourseId);

  const chapterIds = (chapters ?? []).map((c: { id: string }) => c.id);
  if (!chapterIds.length) return;

  const { data: lessons } = await admin
    .from("lessons")
    .select("id")
    .in("chapter_id", chapterIds);

  const lessonIds = (lessons ?? []).map((l: { id: string }) => l.id);
  if (!lessonIds.length) return;

  const { data: questions } = await admin
    .from("questions")
    .select("id")
    .in("lesson_id", lessonIds);

  const questionIds = (questions ?? []).map((q: { id: string }) => q.id);
  if (!questionIds.length) return;

  await admin.from("question_attempts").delete().eq("user_id", userId).in("question_id", questionIds);
}
