import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export type LessonQuestionRow = {
  id: string;
  content: string;
  status: string;
  created_at: string;
  user_id: string;
  lesson_id: string;
  studentCode: string;
  lessonName: string;
  chapterName: string;
  baseCourseName: string;
  programName: string;
  enrollmentIdForStudent: string | null;
  replies: { id: string; user_id: string; content: string; created_at: string }[];
};

/**
 * Load all lesson Q&A for admin dashboard (enriched with hierarchy + replies).
 */
export async function loadAllLessonQuestionsForAdmin(): Promise<LessonQuestionRow[]> {
  const admin = getSupabaseAdminClient();

  const { data: questions, error } = await admin
    .from("lesson_questions")
    .select("id, lesson_id, user_id, content, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error || !questions?.length) {
    return [];
  }

  const lessonIds = [...new Set(questions.map((q) => q.lesson_id))];
  const userIds = [...new Set(questions.map((q) => q.user_id))];
  const questionIds = questions.map((q) => q.id);

  const [{ data: lessons }, { data: profiles }, { data: replies }] = await Promise.all([
    admin.from("lessons").select("id, name, chapter_id").in("id", lessonIds),
    admin.from("profiles").select("id, student_code").in("id", userIds),
    admin
      .from("lesson_question_replies")
      .select("id, lesson_question_id, user_id, content, created_at")
      .in("lesson_question_id", questionIds)
      .order("created_at", { ascending: true }),
  ]);

  const lessonMap = new Map((lessons ?? []).map((l) => [l.id, l]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const chapterIds = [...new Set((lessons ?? []).map((l) => l.chapter_id).filter(Boolean))] as string[];
  const { data: chapters } = chapterIds.length
    ? await admin.from("chapters").select("id, name, base_course_id").in("id", chapterIds)
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

  type ReplyRow = NonNullable<typeof replies>[number];
  const repliesSafe = replies ?? [];
  const repliesByQ = repliesSafe.reduce(
    (acc, r) => {
      const qid = r.lesson_question_id;
      if (!acc[qid]) acc[qid] = [];
      acc[qid]!.push(r);
      return acc;
    },
    {} as Record<string, ReplyRow[]>
  );

  const enrollmentCache = new Map<string, string | null>();

  async function getEnrollmentId(studentUserId: string, baseCourseId: string): Promise<string | null> {
    const key = `${studentUserId}:${baseCourseId}`;
    if (enrollmentCache.has(key)) return enrollmentCache.get(key) ?? null;
    const { data: rcList } = await admin.from("regular_courses").select("id").eq("base_course_id", baseCourseId);
    const rcIds = (rcList ?? []).map((r) => r.id);
    if (!rcIds.length) {
      enrollmentCache.set(key, null);
      return null;
    }
    const { data: enr } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", studentUserId)
      .eq("status", "active")
      .in("regular_course_id", rcIds)
      .limit(1)
      .maybeSingle();
    const id = enr?.id ?? null;
    enrollmentCache.set(key, id);
    return id;
  }

  const rows: LessonQuestionRow[] = [];

  for (const q of questions) {
    const lesson = lessonMap.get(q.lesson_id);
    const chapter = lesson?.chapter_id ? chapterMap.get(lesson.chapter_id) : undefined;
    const bc = chapter?.base_course_id ? baseCourseMap.get(chapter.base_course_id) : undefined;
    const prog = bc?.program_id ? programMap.get(bc.program_id) : undefined;
    const prof = profileMap.get(q.user_id);

    let enrollmentIdForStudent: string | null = null;
    if (chapter?.base_course_id) {
      enrollmentIdForStudent = await getEnrollmentId(q.user_id, chapter.base_course_id);
    }

    rows.push({
      id: q.id,
      content: q.content,
      status: q.status,
      created_at: q.created_at,
      user_id: q.user_id,
      lesson_id: q.lesson_id,
      studentCode: (prof as { student_code?: string | null })?.student_code?.trim() || "—",
      lessonName: lesson?.name ?? "—",
      chapterName: chapter?.name ?? "—",
      baseCourseName: bc?.name ?? "—",
      programName: prog?.name ?? "—",
      enrollmentIdForStudent,
      replies: repliesByQ[q.id] ?? [],
    });
  }

  return rows;
}
