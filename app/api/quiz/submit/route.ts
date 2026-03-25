import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../lib/csrf";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../lib/rate-limit";
import { scoreMultipleChoiceRewardPenalty } from "../../../../lib/quiz-multiple-choice-score";
import {
  buildCorrectAnswerDisplay,
  buildStudentAnswerDisplay,
} from "../../../../lib/quiz-answer-display";
import { isCourseExpiredUncompleted } from "../../../../lib/course-expired-uncompleted";
import { requireCompleteStudentProfileForApi } from "../../../../lib/student-profile-api-guard";

const EPS = 1e-6;

/**
 * POST /api/quiz/submit
 * Body: { questionId, selectedOptionIds?: string[], fillBlankAnswer?: string }
 * Returns: { isCorrect, pointsEarned, maxPoints, studentAnswerDisplay, correctAnswerDisplay? }
 * isCorrect = đạt đủ điểm tối đa (P_max).
 * correctAnswerDisplay CHỈ trả khi: đạt đủ điểm HOẶC đã hết lượt.
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(
    rateLimitKeyFromRequest(request, "quiz-submit"),
    30,
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
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileBlock = await requireCompleteStudentProfileForApi(user.id);
    if (profileBlock) return profileBlock;

    const body = await request.json();
    const { questionId, selectedOptionIds, fillBlankAnswer, enrollmentId } = body;

    if (!questionId) {
      return NextResponse.json({ error: "questionId required" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    if (enrollmentId && (await isCourseExpiredUncompleted(admin, enrollmentId))) {
      return NextResponse.json(
        { error: "Khóa học đã kết thúc, bạn không thể làm bài tập." },
        { status: 403 }
      );
    }

    const { data: question, error: qErr } = await admin
      .from("questions")
      .select("id, type, points, max_attempts")
      .eq("id", questionId)
      .single();

    if (qErr || !question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const { count } = await admin
      .from("question_attempts")
      .select("id", { count: "exact", head: true })
      .eq("question_id", questionId)
      .eq("user_id", user.id);

    const prevAttemptCount = count ?? 0;
    if (prevAttemptCount >= question.max_attempts) {
      return NextResponse.json(
        { error: "Đã hết số lần trả lời", isCorrect: false, pointsEarned: 0 },
        { status: 400 }
      );
    }

    const pMax = Number(question.points) || 1;
    let isCorrect = false;
    let pointsEarned = 0;
    let studentAnswerDisplay = "";
    let correctAnswerDisplay = "";

    if (question.type === "fill_blank") {
      const answer = typeof fillBlankAnswer === "string" ? fillBlankAnswer.trim() : "";
      studentAnswerDisplay = answer || "(để trống)";

      const { data: correctOpt } = await admin
        .from("question_options")
        .select("option_text")
        .eq("question_id", questionId)
        .eq("is_correct", true)
        .single();

      const correctText = (correctOpt as { option_text?: string } | null)?.option_text?.trim() ?? "";
      correctAnswerDisplay = correctText;
      const correctAnswerLower = correctText.toLowerCase();
      isCorrect = answer.toLowerCase() === correctAnswerLower;
      pointsEarned = isCorrect ? pMax : 0;
    } else {
      const selected = Array.isArray(selectedOptionIds) ? selectedOptionIds : [];
      const { data: allOpts } = await admin
        .from("question_options")
        .select("id, option_text, is_correct")
        .eq("question_id", questionId)
        .order("sort_order");

      const optionTextById = new Map(
        (allOpts ?? []).map((o) => [o.id, (o as { option_text?: string }).option_text ?? ""])
      );

      const correctOpts = (allOpts ?? []).filter((o) => o.is_correct);
      const correctIds = new Set(correctOpts.map((o) => o.id));
      const selectedSet = new Set(selected);

      studentAnswerDisplay = buildStudentAnswerDisplay(
        question.type,
        selected,
        null,
        optionTextById
      );
      correctAnswerDisplay = buildCorrectAnswerDisplay(
        correctOpts.map((o) => (o as { option_text?: string }).option_text ?? "")
      );

      if (question.type === "single_choice") {
        isCorrect = selected.length === 1 && correctIds.has(selected[0]);
        pointsEarned = isCorrect ? pMax : 0;
      } else if (question.type === "multiple_choice") {
        const cTotal = correctIds.size;
        const iTotal = (allOpts ?? []).length - cTotal;
        let cSelected = 0;
        let iSelected = 0;
        for (const id of selected) {
          if (correctIds.has(id)) cSelected += 1;
          else iSelected += 1;
        }
        pointsEarned = scoreMultipleChoiceRewardPenalty(
          pMax,
          cTotal,
          iTotal,
          cSelected,
          iSelected
        );
        isCorrect = pointsEarned + EPS >= pMax;
      } else {
        isCorrect =
          correctIds.size === selectedSet.size &&
          [...correctIds].every((id) => selectedSet.has(id));
        pointsEarned = isCorrect ? pMax : 0;
      }
    }

    const attemptCountAfter = prevAttemptCount + 1;
    const maxA = Number(question.max_attempts) || 3;
    const mayShowCorrect =
      pointsEarned + EPS >= pMax || (maxA > 0 && attemptCountAfter >= maxA);

    await admin.from("question_attempts").insert({
      question_id: questionId,
      user_id: user.id,
      selected_option_ids: selectedOptionIds ?? null,
      fill_blank_answer: fillBlankAnswer ?? null,
      is_correct: isCorrect,
      points_earned: pointsEarned,
    });

    const res: {
      isCorrect: boolean;
      pointsEarned: number;
      maxPoints: number;
      studentAnswerDisplay: string;
      correctAnswerDisplay?: string;
    } = {
      isCorrect,
      pointsEarned,
      maxPoints: pMax,
      studentAnswerDisplay,
    };
    if (mayShowCorrect && correctAnswerDisplay) {
      res.correctAnswerDisplay = correctAnswerDisplay;
    }
    return NextResponse.json(res);
  } catch (err) {
    console.error("Quiz submit error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
