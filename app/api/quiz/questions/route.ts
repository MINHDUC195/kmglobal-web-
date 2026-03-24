import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import {
  buildCorrectAnswerDisplay,
  buildStudentAnswerDisplay,
} from "../../../../lib/quiz-answer-display";
import { isCourseExpiredUncompleted } from "../../../../lib/course-expired-uncompleted";
import { resolveEnrollmentPaymentAccess } from "../../../../lib/enrollment-payment-status";
import { getLessonWithAccess } from "../../../../lib/lesson-access";

const EPS = 1e-6;

/**
 * GET /api/quiz/questions?lessonId=... | ?chapterId=... | ?finalExamId=...&enrollmentId=...
 * Returns questions with options - KHÔNG gửi is_correct về frontend
 * Dùng admin client để đọc options (RLS chặn student đọc question_options)
 */
export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get("lessonId");
  const chapterId = request.nextUrl.searchParams.get("chapterId");
  const finalExamId = request.nextUrl.searchParams.get("finalExamId");
  const enrollmentId = request.nextUrl.searchParams.get("enrollmentId");

  if (!lessonId && !chapterId && !finalExamId) {
    return NextResponse.json({ error: "lessonId, chapterId, or finalExamId required" }, { status: 400 });
  }
  if (finalExamId && !enrollmentId) {
    return NextResponse.json({ error: "enrollmentId required when finalExamId is provided" }, { status: 400 });
  }

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

  const admin = getSupabaseAdminClient();

  // Xác định base_course_id từ lesson, chapter hoặc final exam
  let baseCourseId: string | null = null;
  if (lessonId) {
    const { data: lesson } = await admin
      .from("lessons")
      .select("chapter_id")
      .eq("id", lessonId)
      .single();
    if (lesson?.chapter_id) {
      const { data: ch } = await admin
        .from("chapters")
        .select("base_course_id")
        .eq("id", lesson.chapter_id)
        .single();
      baseCourseId = ch?.base_course_id ?? null;
    }
  } else if (chapterId) {
    const { data: ch } = await admin
      .from("chapters")
      .select("base_course_id")
      .eq("id", chapterId)
      .single();
    baseCourseId = ch?.base_course_id ?? null;
  } else if (finalExamId) {
    const { data: fe } = await admin
      .from("final_exams")
      .select("base_course_id")
      .eq("id", finalExamId)
      .single();
    baseCourseId = fe?.base_course_id ?? null;
  }

  // Kiểm tra enrollment (trừ owner/admin)
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  if (!isOwnerOrAdmin && baseCourseId) {
    if (finalExamId && enrollmentId) {
      const { data: enrollCheck } = await admin
        .from("enrollments")
        .select(`
          id,
          payment_id,
          regular_course_id,
          regular_course:regular_courses(base_course_id, price_cents, discount_percent)
        `)
        .eq("id", enrollmentId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();
      if (!enrollCheck) {
        return NextResponse.json({ error: "Enrollment không hợp lệ" }, { status: 403 });
      }
      const rc = enrollCheck.regular_course as { base_course_id?: string } | null;
      if (rc?.base_course_id !== baseCourseId) {
        return NextResponse.json({ error: "Enrollment không thuộc khóa học này" }, { status: 403 });
      }
      const { needsPayment } = await resolveEnrollmentPaymentAccess(admin, {
        payment_id: enrollCheck.payment_id,
        regular_course:
          (enrollCheck.regular_course as {
            price_cents?: number | null;
            discount_percent?: number | null;
          } | null) ?? null,
      });
      if (needsPayment) {
        return NextResponse.json(
          { error: "Cần thanh toán để làm bài thi cuối khóa." },
          { status: 403 }
        );
      }
    } else if (lessonId && enrollmentId) {
      const access = await getLessonWithAccess(admin, user.id, lessonId, enrollmentId);
      if (!access.ok) {
        return NextResponse.json({ error: access.message }, { status: access.status });
      }
    } else {
      const { data: rcList } = await admin
        .from("regular_courses")
        .select("id")
        .eq("base_course_id", baseCourseId);
      const rcIds = (rcList ?? []).map((r) => r.id);
      const { data: enrollCheck } = rcIds.length
        ? await admin
            .from("enrollments")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "active")
            .in("regular_course_id", rcIds)
            .limit(1)
        : { data: [] };
      if (!enrollCheck?.length) {
        return NextResponse.json({ error: "Bạn chưa đăng ký khóa học này" }, { status: 403 });
      }
    }
  } else if (!isOwnerOrAdmin && !baseCourseId) {
    return NextResponse.json({ error: "Không tìm thấy bài học/chương" }, { status: 404 });
  }

  const hideAnswersForExpired =
    !isOwnerOrAdmin &&
    enrollmentId &&
    (await isCourseExpiredUncompleted(admin, enrollmentId));

  let questions: { id: string; content: string; type: string; points: number; max_attempts: number; sort_order?: number }[];

  if (finalExamId) {
    const { data: feq } = await admin
      .from("final_exam_questions")
      .select("question_id, sort_order")
      .eq("final_exam_id", finalExamId)
      .order("sort_order");
    const questionIds = (feq ?? []).map((r) => r.question_id);
    if (!questionIds.length) {
      return NextResponse.json({ questions: [] });
    }
    const { data: qList } = await admin
      .from("questions")
      .select("id, content, type, points, max_attempts")
      .in("id", questionIds);
    const orderMap = (feq ?? []).reduce(
      (acc, r) => {
        acc[r.question_id] = r.sort_order ?? 0;
        return acc;
      },
      {} as Record<string, number>
    );
    questions = (qList ?? []).map((q) => ({
      ...q,
      sort_order: orderMap[q.id] ?? 0,
    }));
    questions.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  } else {
    // Bắt buộc dùng admin: RLS đã thu hẹp — học viên không SELECT trực tiếp bảng questions.
    const { data, error: qErr } = lessonId
      ? await admin
          .from("questions")
          .select("id, content, type, points, max_attempts")
          .eq("lesson_id", lessonId)
          .order("created_at")
      : await admin
          .from("questions")
          .select("id, content, type, points, max_attempts")
          .eq("chapter_id", chapterId!)
          .order("created_at");
    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }
    questions = data ?? [];
  }

  if (!questions?.length) {
    return NextResponse.json({ questions: [] });
  }

  const questionIds = questions.map((q) => q.id);
  const { data: attemptsFull } = await admin
    .from("question_attempts")
    .select(
      "question_id, is_correct, points_earned, selected_option_ids, fill_blank_answer, created_at"
    )
    .in("question_id", questionIds)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const attemptStats = (attemptsFull ?? []).reduce(
    (acc, a) => {
      if (!acc[a.question_id]) {
        acc[a.question_id] = { count: 0, hasCorrect: false, pointsEarned: 0 };
      }
      acc[a.question_id].count += 1;
      const pts = Number(a.points_earned) || 0;
      acc[a.question_id].pointsEarned = Math.max(acc[a.question_id].pointsEarned, pts);
      if (a.is_correct) {
        acc[a.question_id].hasCorrect = true;
      }
      return acc;
    },
    {} as Record<string, { count: number; hasCorrect: boolean; pointsEarned: number }>
  );

  const lastAttemptByQuestion = new Map<
    string,
    {
      selected_option_ids: string[] | null;
      fill_blank_answer: string | null;
    }
  >();
  const bestAttemptByQuestion = new Map<
    string,
    {
      selected_option_ids: string[] | null;
      fill_blank_answer: string | null;
    }
  >();
  for (const row of attemptsFull ?? []) {
    if (!lastAttemptByQuestion.has(row.question_id)) {
      lastAttemptByQuestion.set(row.question_id, {
        selected_option_ids: (row.selected_option_ids as string[] | null) ?? null,
        fill_blank_answer: (row.fill_blank_answer as string | null) ?? null,
      });
    }
    if (!bestAttemptByQuestion.has(row.question_id) && row.is_correct) {
      bestAttemptByQuestion.set(row.question_id, {
        selected_option_ids: (row.selected_option_ids as string[] | null) ?? null,
        fill_blank_answer: (row.fill_blank_answer as string | null) ?? null,
      });
    }
  }

  const { data: allOptions } = await admin
    .from("question_options")
    .select("id, question_id, option_text, sort_order, is_correct")
    .in("question_id", questions.map((q) => q.id));

  const optionsByQuestion = (allOptions ?? []).reduce(
    (acc, opt) => {
      if (!acc[opt.question_id]) acc[opt.question_id] = [];
      acc[opt.question_id].push({
        id: opt.id,
        option_text: opt.option_text,
        sort_order: opt.sort_order ?? 0,
        is_correct: !!(opt as { is_correct?: boolean }).is_correct,
      });
      return acc;
    },
    {} as Record<
      string,
      { id: string; option_text: string; sort_order: number; is_correct: boolean }[]
    >
  );

  const optionTextByQuestion = (allOptions ?? []).reduce(
    (acc, opt) => {
      if (!acc[opt.question_id]) acc[opt.question_id] = new Map<string, string>();
      acc[opt.question_id].set(opt.id, opt.option_text ?? "");
      return acc;
    },
    {} as Record<string, Map<string, string>>
  );

  const result = questions.map((q) => {
    const stats = attemptStats[q.id] ?? { count: 0, hasCorrect: false, pointsEarned: 0 };
    const pMax = Number(q.points) || 1;
    const maxA = q.max_attempts ?? 3;
    const fullCredit =
      stats.hasCorrect || stats.pointsEarned + EPS >= pMax;
    const exhausted = maxA > 0 && stats.count >= maxA;
    const mayShowFeedback = fullCredit || exhausted;
    const last = lastAttemptByQuestion.get(q.id);
    const best = bestAttemptByQuestion.get(q.id);
    const attemptToShow = fullCredit && best ? best : last;
    let studentAnswerDisplay: string | undefined;
    let correctAnswerDisplay: string | undefined;
    if (mayShowFeedback && attemptToShow) {
      const textMap = optionTextByQuestion[q.id] ?? new Map<string, string>();
      studentAnswerDisplay = buildStudentAnswerDisplay(
        q.type,
        attemptToShow.selected_option_ids,
        attemptToShow.fill_blank_answer,
        textMap
      );
      const correctTexts = (optionsByQuestion[q.id] ?? [])
        .filter((o) => o.is_correct)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((o) => o.option_text);
      correctAnswerDisplay = buildCorrectAnswerDisplay(correctTexts);
    }

    return {
      ...q,
      options: (optionsByQuestion[q.id] ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(({ id, option_text }) => ({ id, option_text })),
      attempt_count: stats.count,
      points_earned: stats.pointsEarned,
      has_correct: stats.hasCorrect,
      ...(mayShowFeedback && last && !hideAnswersForExpired
        ? {
            student_answer_display: studentAnswerDisplay,
            correct_answer_display: correctAnswerDisplay,
          }
        : {}),
      ...(hideAnswersForExpired ? { course_expired_locked: true } : {}),
    };
  });

  return NextResponse.json({ questions: result });
}
