/**
 * GET /api/admin/final-exam/questions?baseCourseId=...
 * Lấy bài thi cuối và danh sách câu hỏi đã gắn
 *
 * POST /api/admin/final-exam/questions
 * Body: { baseCourseId, questionId } - gắn câu hỏi vào bài thi
 *
 * DELETE /api/admin/final-exam/questions?baseCourseId=...&questionId=...
 * Gỡ câu hỏi khỏi bài thi
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../../lib/csrf";

export async function GET(request: NextRequest) {
  const baseCourseId = request.nextUrl.searchParams.get("baseCourseId");
  if (!baseCourseId) {
    return NextResponse.json({ error: "baseCourseId required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();

  let { data: finalExam } = await admin
    .from("final_exams")
    .select("id, name")
    .eq("base_course_id", baseCourseId)
    .limit(1)
    .single();

  if (!finalExam) {
    const { data: created } = await admin
      .from("final_exams")
      .insert({ base_course_id: baseCourseId, name: "Bài kiểm tra tổng hợp" })
      .select("id, name")
      .single();
    finalExam = created;
  }

  if (!finalExam) {
    return NextResponse.json({ error: "Không thể tạo bài thi" }, { status: 500 });
  }

  const { data: feq } = await admin
    .from("final_exam_questions")
    .select("question_id, sort_order")
    .eq("final_exam_id", finalExam.id)
    .order("sort_order");

  const questionIds = (feq ?? []).map((r) => r.question_id);
  const questions =
    questionIds.length > 0
      ? await admin
          .from("questions")
          .select("id, content, type, points")
          .in("id", questionIds)
      : { data: [] };

  const orderMap = (feq ?? []).reduce(
    (acc, r) => {
      acc[r.question_id] = r.sort_order ?? 0;
      return acc;
    },
    {} as Record<string, number>
  );

  const sorted = (questions.data ?? []).sort(
    (a, b) => (orderMap[a.id] ?? 0) - (orderMap[b.id] ?? 0)
  );

  return NextResponse.json({
    finalExam: { id: finalExam.id, name: finalExam.name },
    questions: sorted,
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role?: string } | null)?.role;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { baseCourseId, questionId } = body;
    if (!baseCourseId || !questionId) {
      return NextResponse.json({ error: "baseCourseId và questionId required" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    let { data: finalExam } = await admin
      .from("final_exams")
      .select("id")
      .eq("base_course_id", baseCourseId)
      .limit(1)
      .single();

    if (!finalExam) {
      const { data: created } = await admin
        .from("final_exams")
        .insert({ base_course_id: baseCourseId, name: "Bài kiểm tra tổng hợp" })
        .select("id")
        .single();
      finalExam = created;
    }

    if (!finalExam) {
      return NextResponse.json({ error: "Không thể tạo bài thi" }, { status: 500 });
    }

    const { error } = await admin.from("final_exam_questions").insert({
      final_exam_id: finalExam.id,
      question_id: questionId,
      sort_order: 999,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Câu hỏi đã có trong bài thi" }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const baseCourseId = request.nextUrl.searchParams.get("baseCourseId");
  const questionId = request.nextUrl.searchParams.get("questionId");
  if (!baseCourseId || !questionId) {
    return NextResponse.json({ error: "baseCourseId và questionId required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();

  const { data: finalExam } = await admin
    .from("final_exams")
    .select("id")
    .eq("base_course_id", baseCourseId)
    .limit(1)
    .single();

  if (!finalExam) {
    return NextResponse.json({ error: "Không tìm thấy bài thi" }, { status: 404 });
  }

  await admin
    .from("final_exam_questions")
    .delete()
    .eq("final_exam_id", finalExam.id)
    .eq("question_id", questionId);

  return NextResponse.json({ success: true });
}
