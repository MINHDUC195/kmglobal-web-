import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true if every lesson in the base course has a lesson_progress row for this enrollment.
 * If the course has no lessons, returns true.
 */
export async function hasCompletedAllLessonsForEnrollment(
  admin: SupabaseClient,
  enrollmentId: string,
  baseCourseId: string
): Promise<boolean> {
  const { data: chapters } = await admin
    .from("chapters")
    .select("id")
    .eq("base_course_id", baseCourseId);

  const chapterIds = (chapters ?? []).map((c) => c.id);
  if (chapterIds.length === 0) return true;

  const { data: lessons } = await admin
    .from("lessons")
    .select("id")
    .in("chapter_id", chapterIds);

  const lessonIds = (lessons ?? []).map((l) => l.id);
  if (lessonIds.length === 0) return true;

  const { count, error } = await admin
    .from("lesson_progress")
    .select("*", { count: "exact", head: true })
    .eq("enrollment_id", enrollmentId)
    .in("lesson_id", lessonIds);

  if (error) return false;
  return (count ?? 0) >= lessonIds.length;
}
