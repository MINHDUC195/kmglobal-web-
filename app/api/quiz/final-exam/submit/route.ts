/**
 * POST /api/quiz/final-exam/submit
 * Nộp bài thi cuối khóa, chấm điểm, tạo final_exam_attempt.
 * Chứng chỉ khi điểm tổng khóa học (quá trình + thi cuối theo trọng số) >= certificate_pass_percent.
 * Body: { enrollmentId, finalExamId, answers: [{ questionId, selectedOptionIds?, fillBlankAnswer? }] }
 */

import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../../lib/csrf";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../../lib/rate-limit";
import { scoreMultipleChoiceRewardPenalty } from "../../../../../lib/quiz-multiple-choice-score";
import { computeOverallCoursePercent } from "../../../../../lib/course-overall-score";

const EPS = 1e-6;

type ExamAnswer = {
  questionId: string;
  selectedOptionIds?: string[];
  fillBlankAnswer?: string;
};

function generateCertificateCode(): string {
  const buf = randomBytes(6);
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `KM-${hex}`;
}

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(
    rateLimitKeyFromRequest(request, "final-exam-submit"),
    10,
    60_000
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429 }
    );
  }
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { enrollmentId, finalExamId, answers } = body;

    if (!enrollmentId || !finalExamId || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "enrollmentId, finalExamId và answers (mảng) là bắt buộc" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();

    const { data: enrollment, error: eErr } = await admin
      .from("enrollments")
      .select(`
        id,
        user_id,
        regular_course_id,
        regular_course:regular_courses(id, name, base_course_id)
      `)
      .eq("id", enrollmentId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (eErr || !enrollment) {
      return NextResponse.json({ error: "Enrollment không hợp lệ" }, { status: 404 });
    }

    const baseCourseId = (enrollment.regular_course as { base_course_id?: string } | null)?.base_course_id;
    if (!baseCourseId) {
      return NextResponse.json({ error: "Khóa học không hợp lệ" }, { status: 400 });
    }

    let passThreshold = 70;
    const { data: baseCourse, error: bcErr } = await admin
      .from("base_courses")
      .select("certificate_pass_percent")
      .eq("id", baseCourseId)
      .single();
    if (!bcErr && baseCourse?.certificate_pass_percent != null) {
      passThreshold = Number(baseCourse.certificate_pass_percent) || 70;
    }

    const { data: existingCert } = await admin
      .from("certificates")
      .select("id, code, percent_score, issued_at")
      .eq("enrollment_id", enrollmentId)
      .maybeSingle();
    if (existingCert) {
      return NextResponse.json({
        passed: true,
        passThreshold,
        totalPoints: 0,
        maxPoints: 0,
        percentScore: existingCert.percent_score,
        overallPercent: existingCert.percent_score,
        certificate: {
          id: existingCert.id,
          code: existingCert.code,
          percentScore: existingCert.percent_score,
          issuedAt: existingCert.issued_at,
        },
      });
    }

    const { data: finalExam } = await admin
      .from("final_exams")
      .select("id, base_course_id")
      .eq("id", finalExamId)
      .eq("base_course_id", baseCourseId)
      .single();

    if (!finalExam) {
      return NextResponse.json({ error: "Bài thi cuối không tồn tại" }, { status: 404 });
    }

    const { data: feQuestions } = await admin
      .from("final_exam_questions")
      .select("question_id")
      .eq("final_exam_id", finalExamId);

    const examQuestionIds = new Set((feQuestions ?? []).map((r) => r.question_id));
    if (examQuestionIds.size === 0) {
      return NextResponse.json({ error: "Bài thi chưa có câu hỏi" }, { status: 400 });
    }

    const answersMap = new Map(
      (answers as ExamAnswer[]).map((a) => [a.questionId, a])
    );

    let totalEarned = 0;
    let maxPoints = 0;

    for (const questionId of examQuestionIds) {
      const { data: q } = await admin
        .from("questions")
        .select("id, type, points")
        .eq("id", questionId)
        .single();
      if (!q) continue;

      const pts = Number(q.points) || 1;
      maxPoints += pts;

      const ans = answersMap.get(questionId);
      let earned = 0;

      if (q.type === "fill_blank") {
        const answer = typeof ans?.fillBlankAnswer === "string" ? ans.fillBlankAnswer.trim() : "";
        const { data: correctOpt } = await admin
          .from("question_options")
          .select("option_text")
          .eq("question_id", questionId)
          .eq("is_correct", true)
          .single();
        const correct = (correctOpt as { option_text?: string } | null)?.option_text?.trim().toLowerCase() ?? "";
        earned = answer.toLowerCase() === correct ? pts : 0;
      } else {
        const selected = Array.isArray(ans?.selectedOptionIds) ? ans.selectedOptionIds : [];
        const { data: allOpts } = await admin
          .from("question_options")
          .select("id, is_correct")
          .eq("question_id", questionId)
          .order("sort_order");
        const correctOpts = (allOpts ?? []).filter((o) => o.is_correct);
        const correctIds = new Set(correctOpts.map((o) => o.id));
        const selectedSet = new Set(selected);

        if (q.type === "single_choice") {
          const full = selected.length === 1 && correctIds.has(selected[0]);
          earned = full ? pts : 0;
        } else if (q.type === "multiple_choice") {
          const cTotal = correctIds.size;
          const iTotal = (allOpts ?? []).length - cTotal;
          let cSelected = 0;
          let iSelected = 0;
          for (const id of selected) {
            if (correctIds.has(id)) cSelected += 1;
            else iSelected += 1;
          }
          earned = scoreMultipleChoiceRewardPenalty(
            pts,
            cTotal,
            iTotal,
            cSelected,
            iSelected
          );
        } else {
          const full =
            correctIds.size === selectedSet.size &&
            [...correctIds].every((id) => selectedSet.has(id));
          earned = full ? pts : 0;
        }
      }

      totalEarned += earned;

      const fullCredit = earned + EPS >= pts;

      await admin.from("question_attempts").insert({
        question_id: questionId,
        user_id: user.id,
        selected_option_ids: ans?.selectedOptionIds ?? null,
        fill_blank_answer: ans?.fillBlankAnswer ?? null,
        is_correct: fullCredit,
        points_earned: earned,
      });
    }

    const percentScore = maxPoints > 0 ? Math.round((totalEarned / maxPoints) * 100) : 0;

    const { overallPercent } = await computeOverallCoursePercent(admin, {
      userId: user.id,
      enrollmentId,
      baseCourseId,
      finalExamPercent: percentScore,
    });

    const passed = overallPercent >= passThreshold;

    const { data: attempt, error: attemptErr } = await admin
      .from("final_exam_attempts")
      .insert({
        enrollment_id: enrollmentId,
        final_exam_id: finalExamId,
        user_id: user.id,
        total_points: totalEarned,
        max_points: maxPoints,
        percent_score: percentScore,
        passed,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (attemptErr) {
      return NextResponse.json({ error: "Không thể lưu kết quả thi" }, { status: 500 });
    }

    let certificate = null;
    let certificateBlockedReason: string | null = null;

    if (passed) {
      let code = generateCertificateCode();
      let retries = 0;
      while (retries < 5) {
        const { data: existing } = await admin
          .from("certificates")
          .select("id")
          .eq("code", code)
          .limit(1)
          .single();
        if (!existing) break;
        code = generateCertificateCode();
        retries++;
      }

      const { data: cert, error: certErr } = await admin
        .from("certificates")
        .insert({
          code,
          enrollment_id: enrollmentId,
          user_id: user.id,
          regular_course_id: enrollment.regular_course_id,
          base_course_id: baseCourseId,
          final_exam_attempt_id: attempt.id,
          percent_score: overallPercent,
        })
        .select("id, code, percent_score, issued_at")
        .single();

      if (certErr || !cert) {
        certificateBlockedReason =
          "Đã đạt điều kiện điểm tổng nhưng không thể tạo chứng chỉ. Vui lòng liên hệ quản trị.";
      } else {
        certificate = cert;
      }
    }

    return NextResponse.json({
      passed,
      passThreshold,
      totalPoints: totalEarned,
      maxPoints,
      percentScore,
      overallPercent,
      certificate: certificate
        ? {
            id: certificate.id,
            code: certificate.code,
            percentScore: certificate.percent_score,
            issuedAt: certificate.issued_at,
          }
        : null,
      certificateBlockedReason,
    });
  } catch (err) {
    console.error("Final exam submit error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
