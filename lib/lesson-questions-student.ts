import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type StudentLessonQuestionItem = {
  id: string;
  content: string;
  status: string;
  created_at: string;
  lesson_id: string;
  lessonName: string;
  baseCourseName: string;
  programName: string;
  enrollmentId: string | null;
  hasReplies: boolean;
};

export async function loadLessonQuestionsForStudent(userId: string): Promise<StudentLessonQuestionItem[]> {
  const admin = getSupabaseAdminClient();

  const { data: questions, error } = await admin
    .from("lesson_questions")
    .select("id, lesson_id, content, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !questions?.length) {
    return [];
  }

  const lessonIds = [...new Set(questions.map((q) => q.lesson_id))];
  const { data: lessons } = await admin.from("lessons").select("id, name, chapter_id").in("id", lessonIds);
  const lessonMap = new Map((lessons ?? []).map((l) => [l.id, l]));

  const chapterIds = [...new Set((lessons ?? []).map((l) => l.chapter_id).filter(Boolean))] as string[];
  const { data: chapters } = chapterIds.length
    ? await admin.from("chapters").select("id, base_course_id").in("id", chapterIds)
    : { data: [] };

  const chapterMap = new Map((chapters ?? []).map((c) => [c.id, c]));
  const baseCourseIds = [...new Set((chapters ?? []).map((c) => c.base_course_id).filter(Boolean))] as string[];

  const { data: baseCourses } = baseCourseIds.length
    ? await admin.from("base_courses").select("id, name, program_id").in("id", baseCourseIds)
    : { data: [] };

  const baseCourseMap = new Map((baseCourses ?? []).map((bc) => [bc.id, bc]));
  const programIds = [...new Set((baseCourses ?? []).map((bc) => bc.program_id).filter(Boolean))] as string[];

  const { data: programs } = programIds.length
    ? await admin.from("programs").select("id, name").in("id", programIds)
    : { data: [] };

  const programMap = new Map((programs ?? []).map((p) => [p.id, p]));

  const qIds = questions.map((q) => q.id);
  const { data: replyCounts } = await admin
    .from("lesson_question_replies")
    .select("lesson_question_id")
    .in("lesson_question_id", qIds);

  const hasReplySet = new Set((replyCounts ?? []).map((r) => r.lesson_question_id));

  const enrollmentCache = new Map<string, string | null>();

  async function getEnrollmentId(baseCourseId: string): Promise<string | null> {
    if (enrollmentCache.has(baseCourseId)) return enrollmentCache.get(baseCourseId) ?? null;
    const { data: rcList } = await admin.from("regular_courses").select("id").eq("base_course_id", baseCourseId);
    const rcIds = (rcList ?? []).map((r) => r.id);
    if (!rcIds.length) {
      enrollmentCache.set(baseCourseId, null);
      return null;
    }
    const { data: enr } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("regular_course_id", rcIds)
      .limit(1)
      .maybeSingle();
    const id = enr?.id ?? null;
    enrollmentCache.set(baseCourseId, id);
    return id;
  }

  const items: StudentLessonQuestionItem[] = [];

  for (const q of questions) {
    const lesson = lessonMap.get(q.lesson_id);
    const chapter = lesson?.chapter_id ? chapterMap.get(lesson.chapter_id) : undefined;
    const bc = chapter?.base_course_id ? baseCourseMap.get(chapter.base_course_id) : undefined;
    const prog = bc?.program_id ? programMap.get(bc.program_id) : undefined;

    let enrollmentId: string | null = null;
    if (chapter?.base_course_id) {
      enrollmentId = await getEnrollmentId(chapter.base_course_id);
    }

    items.push({
      id: q.id,
      content: q.content,
      status: q.status,
      created_at: q.created_at,
      lesson_id: q.lesson_id,
      lessonName: lesson?.name ?? "—",
      baseCourseName: bc?.name ?? "—",
      programName: prog?.name ?? "—",
      enrollmentId,
      hasReplies: hasReplySet.has(q.id),
    });
  }

  return items;
}
