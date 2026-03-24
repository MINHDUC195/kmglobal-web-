import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lấy danh sách base_course_id mà học viên đã học (có enrollment hoặc certificate)
 * → trả về các new_base_course_id cần ẩn (khóa mới/Rev) dựa trên base_course_improvements.
 * Học viên đã học khóa cũ không được xem khóa mới.
 */
export async function getBaseCourseIdsToHideForUser(
  admin: SupabaseClient,
  userId: string | null
): Promise<Set<string>> {
  if (!userId) return new Set();

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("regular_course_id")
    .eq("user_id", userId);

  const rcIds = (enrollments ?? [])
    .map((e) => (e as { regular_course_id?: string }).regular_course_id)
    .filter(Boolean) as string[];

  if (rcIds.length === 0) return new Set();

  const { data: rcs } = await admin
    .from("regular_courses")
    .select("base_course_id")
    .in("id", rcIds);

  const oldBaseCourseIds = new Set(
    (rcs ?? []).map((r) => (r as { base_course_id: string }).base_course_id).filter(Boolean)
  );

  if (oldBaseCourseIds.size === 0) return new Set();

  const { data: improvements } = await admin
    .from("base_course_improvements")
    .select("new_base_course_id")
    .in("source_base_course_id", [...oldBaseCourseIds]);

  return new Set(
    (improvements ?? []).map(
      (r) => (r as { new_base_course_id: string }).new_base_course_id
    )
  );
}
