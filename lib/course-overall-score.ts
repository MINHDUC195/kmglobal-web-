import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Điểm tổng khóa học (0–100): trọng số quá trình (bài học/quiz) + trọng số bài thi cuối,
 * cùng công thức với trang /learn/[enrollmentId]/progress.
 */
export async function computeOverallCoursePercent(
  admin: SupabaseClient,
  params: {
    userId: string;
    enrollmentId: string;
    baseCourseId: string;
    /** Điểm % bài thi cuối (0–100), thường là lần nộp hiện tại */
    finalExamPercent: number;
  }
): Promise<{
  overallPercent: number;
  lessonWeight: number;
  examWeight: number;
  lessonPercentRaw: number;
}> {
  const { data: bc } = await admin
    .from("base_courses")
    .select("final_exam_weight_percent")
    .eq("id", params.baseCourseId)
    .single();

  const examWeight = Number(bc?.final_exam_weight_percent) ?? 30;
  const lessonWeight = Math.max(0, Math.min(100, 100 - examWeight));

  const { data: chapters } = await admin
    .from("chapters")
    .select("id, name, sort_order")
    .eq("base_course_id", params.baseCourseId)
    .order("sort_order");
  const chapterIds = (chapters ?? []).map((c) => c.id);

  const { data: allLessons } = chapterIds.length
    ? await admin
        .from("lessons")
        .select("id, chapter_id, name, sort_order")
        .in("chapter_id", chapterIds)
        .order("sort_order")
    : { data: [] };

  const lessonIds = (allLessons ?? []).map((l) => l.id);

  const { data: questions } = lessonIds.length
    ? await admin
        .from("questions")
        .select("id, lesson_id, points")
        .in("lesson_id", lessonIds)
    : { data: [] };

  const questionIds = (questions ?? []).map((q) => q.id);

  const bestPointsByQuestion: Record<string, number> = {};
  if (questionIds.length > 0) {
    const { data: attempts } = await admin
      .from("question_attempts")
      .select("question_id, points_earned")
      .in("question_id", questionIds)
      .eq("user_id", params.userId);
    for (const a of attempts ?? []) {
      const pts = Number(a.points_earned) || 0;
      const prev = bestPointsByQuestion[a.question_id] ?? 0;
      bestPointsByQuestion[a.question_id] = Math.max(prev, pts);
    }
  }

  const { data: progressRows } = await admin
    .from("lesson_progress")
    .select("lesson_id")
    .eq("enrollment_id", params.enrollmentId);
  const completedLessonIds = new Set((progressRows ?? []).map((p) => p.lesson_id));

  const questionsByLesson = (questions ?? []).reduce(
    (acc, q) => {
      if (!q.lesson_id) return acc;
      if (!acc[q.lesson_id]) acc[q.lesson_id] = [];
      acc[q.lesson_id].push(q);
      return acc;
    },
    {} as Record<string, { id: string; lesson_id: string; points: number }[]>
  );

  let totalLessonMax = 0;
  let totalLessonEarned = 0;

  for (const lesson of allLessons ?? []) {
    const lessonQs = questionsByLesson[lesson.id] ?? [];
    let maxP = lessonQs.reduce((s, q) => s + (Number(q.points) || 1), 0);
    let earnedP = lessonQs.reduce((s, q) => s + (bestPointsByQuestion[q.id] ?? 0), 0);
    if (lessonQs.length === 0) {
      maxP = 1;
      earnedP = completedLessonIds.has(lesson.id) ? 1 : 0;
    }
    totalLessonMax += maxP;
    totalLessonEarned += earnedP;
  }

  const lessonPercentRaw =
    totalLessonMax > 0 ? (totalLessonEarned / totalLessonMax) * 100 : 0;
  const lessonPercentContribution = (lessonPercentRaw / 100) * lessonWeight;
  const examContribution = (Math.max(0, Math.min(100, params.finalExamPercent)) / 100) * examWeight;
  const overallPercent = Math.min(100, Math.round(lessonPercentContribution + examContribution));

  return {
    overallPercent,
    lessonWeight,
    examWeight,
    lessonPercentRaw,
  };
}
