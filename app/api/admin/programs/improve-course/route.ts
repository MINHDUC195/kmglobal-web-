/**
 * POST /api/admin/programs/improve-course
 * Cải tiến khóa học: clone base course + program (draft) với mã RevN
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../../lib/rate-limit";
import { validateOrigin } from "../../../../../lib/csrf";

export const maxDuration = 300;

async function ensureAdminOrOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  return role === "owner" || role === "admin";
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const rl = await checkRateLimit(
    rateLimitKeyFromRequest(request, "improve-course"),
    5,
    3_600_000
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu cải tiến. Thử lại sau." },
      { status: 429 }
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!(await ensureAdminOrOwner(supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { baseCourseId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const baseCourseId = body.baseCourseId?.trim();
  const reason = (body.reason?.trim() || "").slice(0, 5000);

  if (!baseCourseId) {
    return NextResponse.json({ error: "baseCourseId là bắt buộc" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: bc, error: bcErr } = await admin
    .from("base_courses")
    .select("*, program:programs(id, name, code, approval_status)")
    .eq("id", baseCourseId)
    .single();

  if (bcErr || !bc) {
    return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
  }

  const program = bc.program as { id: string; name: string; code: string | null; approval_status?: string } | null;
  if (!program || program.approval_status !== "approved") {
    return NextResponse.json({ error: "Chỉ có thể cải tiến khóa học thuộc chương trình đã phê duyệt" }, { status: 400 });
  }

  const { count } = await admin
    .from("base_course_improvements")
    .select("id", { count: "exact", head: true })
    .eq("source_base_course_id", baseCourseId);

  const revNum = (count ?? 0) + 1;
  const revSuffix = ` Rev${revNum}`;
  const progCode = (program.code || `P-${program.id.slice(0, 8)}`) + revSuffix;
  const bcCode = (bc.code || `BC-${bc.id.slice(0, 8)}`) + revSuffix;

  const { data: newProgram, error: progErr } = await admin
    .from("programs")
    .insert({
      name: `${program.name} - Cải tiến Rev${revNum}`,
      code: progCode,
      note: reason || null,
      approval_status: "draft",
    })
    .select("id")
    .single();

  if (progErr || !newProgram) {
    return NextResponse.json({ error: progErr?.message || "Không tạo được chương trình" }, { status: 500 });
  }

  const { data: newBc, error: bcCreateErr } = await admin
    .from("base_courses")
    .insert({
      program_id: newProgram.id,
      code: bcCode,
      name: bc.name,
      summary: bc.summary,
      objectives: bc.objectives,
      difficulty_level: bc.difficulty_level,
      prerequisite: bc.prerequisite,
      chapter_weight_json: bc.chapter_weight_json,
      final_exam_weight_percent: bc.final_exam_weight_percent ?? 30,
    })
    .select("id")
    .single();

  if (bcCreateErr || !newBc) {
    return NextResponse.json({ error: bcCreateErr?.message || "Không tạo được khóa học" }, { status: 500 });
  }

  const { data: chapters } = await admin
    .from("chapters")
    .select("id, sort_order, name, objectives, weight_percent")
    .eq("base_course_id", baseCourseId)
    .order("sort_order", { ascending: true });

  const oldToNewChapter = new Map<string, string>();
  for (const ch of chapters ?? []) {
    const { data: newCh } = await admin
      .from("chapters")
      .insert({
        base_course_id: newBc.id,
        sort_order: ch.sort_order,
        name: ch.name,
        objectives: ch.objectives,
        weight_percent: ch.weight_percent,
      })
      .select("id")
      .single();
    if (newCh) oldToNewChapter.set(ch.id, newCh.id);
  }

  const { data: chapterRows } = await admin
    .from("chapters")
    .select("id")
    .eq("base_course_id", baseCourseId);

  const chapterIds = (chapterRows ?? []).map((c) => c.id);
  const { data: lessonList } = chapterIds.length > 0
    ? await admin
        .from("lessons")
        .select("id, chapter_id, sort_order, name, description, video_url, document_url")
        .in("chapter_id", chapterIds)
        .order("sort_order", { ascending: true })
    : { data: [] as { id: string; chapter_id: string; sort_order: number; name: string; description: string | null; video_url: string | null; document_url: string | null }[] };

  const oldToNewLesson = new Map<string, string>();
  for (const les of lessonList ?? []) {
    const newChapterId = oldToNewChapter.get(les.chapter_id);
    if (!newChapterId) continue;
    const { data: newLes } = await admin
      .from("lessons")
      .insert({
        chapter_id: newChapterId,
        sort_order: les.sort_order,
        name: les.name,
        description: les.description,
        video_url: les.video_url,
        document_url: les.document_url,
      })
      .select("id")
      .single();
    if (newLes) oldToNewLesson.set(les.id, newLes.id);
  }

  const lessonIds = [...oldToNewLesson.keys()];
  const { data: questions } = lessonIds.length > 0
    ? await admin
        .from("questions")
        .select("id, lesson_id, chapter_id, content, type, points, max_attempts")
        .in("lesson_id", lessonIds)
    : { data: [] };

  const oldToNewQuestion = new Map<string, string>();
  for (const q of questions ?? []) {
    const newLessonId = oldToNewLesson.get(q.lesson_id);
    const newChapterId = q.chapter_id ? oldToNewChapter.get(q.chapter_id) : null;
    if (!newLessonId) continue;
    const { data: newQ } = await admin
      .from("questions")
      .insert({
        lesson_id: newLessonId,
        chapter_id: newChapterId,
        content: q.content,
        type: q.type,
        points: q.points ?? 1,
        max_attempts: q.max_attempts ?? 1,
      })
      .select("id")
      .single();
    if (newQ) oldToNewQuestion.set(q.id, newQ.id);
  }

  const { data: opts } = questions?.length
    ? await admin.from("question_options").select("question_id, option_text, sort_order, is_correct").in("question_id", questions.map((q) => q.id))
    : { data: [] as { question_id: string; option_text: string; sort_order: number; is_correct: boolean }[] };

  for (const opt of opts ?? []) {
    const newQid = oldToNewQuestion.get(opt.question_id);
    if (!newQid) continue;
    await admin.from("question_options").insert({
      question_id: newQid,
      option_text: opt.option_text,
      sort_order: opt.sort_order ?? 0,
      is_correct: opt.is_correct ?? false,
    });
  }

  const { data: oldExams } = await admin.from("final_exams").select("id, name").eq("base_course_id", baseCourseId);
  const oldToNewExam = new Map<string, string>();
  for (const ex of oldExams ?? []) {
    const { data: newEx } = await admin
      .from("final_exams")
      .insert({ base_course_id: newBc.id, name: ex.name })
      .select("id")
      .single();
    if (newEx) oldToNewExam.set(ex.id, newEx.id);
  }

  const { data: feqList } = oldExams?.length
    ? await admin.from("final_exam_questions").select("final_exam_id, question_id, sort_order").in("final_exam_id", oldExams.map((e) => e.id))
    : { data: [] };

  for (const feq of feqList ?? []) {
    const newExamId = oldToNewExam.get(feq.final_exam_id);
    const newQid = oldToNewQuestion.get(feq.question_id);
    if (newExamId && newQid) {
      await admin.from("final_exam_questions").insert({
        final_exam_id: newExamId,
        question_id: newQid,
        sort_order: feq.sort_order ?? 0,
      });
    }
  }

  await admin.from("base_course_improvements").insert({
    source_base_course_id: baseCourseId,
    new_base_course_id: newBc.id,
    source_program_id: program.id,
    new_program_id: newProgram.id,
    reason: reason || null,
    revision_number: revNum,
  });

  return NextResponse.json({
    success: true,
    newProgramId: newProgram.id,
    newBaseCourseId: newBc.id,
  });
}
