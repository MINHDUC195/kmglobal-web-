import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateLessonQuestionContent } from "@/lib/lesson-question-validation";

/**
 * GET /api/lesson-questions?lessonId=...&enrollmentId=...
 * Student: chỉ câu hỏi của mình. Admin: tất cả câu hỏi của lesson.
 */
export async function GET(request: NextRequest) {
  const lessonId = request.nextUrl.searchParams.get("lessonId");
  const enrollmentId = request.nextUrl.searchParams.get("enrollmentId");

  if (!lessonId) {
    return NextResponse.json({ error: "lessonId required" }, { status: 400 });
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

  const { data: lesson } = await admin
    .from("lessons")
    .select("id, chapter_id")
    .eq("id", lessonId)
    .single();
  if (!lesson?.chapter_id) {
    return NextResponse.json({ error: "Bài học không tồn tại" }, { status: 404 });
  }

  const { data: chapter } = await admin
    .from("chapters")
    .select("base_course_id")
    .eq("id", lesson.chapter_id)
    .single();
  const baseCourseId = chapter?.base_course_id;
  if (!baseCourseId) {
    return NextResponse.json({ error: "Chương không tồn tại" }, { status: 404 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  const isOwnerOrAdmin = role === "owner" || role === "admin";

  if (!isOwnerOrAdmin) {
    const { data: rcList } = await admin
      .from("regular_courses")
      .select("id")
      .eq("base_course_id", baseCourseId);
    const rcIds = (rcList ?? []).map((r) => r.id);
    const { data: enrollments } = rcIds.length
      ? await admin
          .from("enrollments")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .in("regular_course_id", rcIds)
      : { data: [] };
    if (!enrollmentId && enrollments?.length) {
      return NextResponse.json({ error: "enrollmentId required" }, { status: 400 });
    }
    if (enrollmentId) {
      const hasEnrollment = (enrollments ?? []).some((e) => e.id === enrollmentId);
      if (!hasEnrollment) {
        return NextResponse.json({ error: "Bạn chưa đăng ký khóa học này" }, { status: 403 });
      }
    } else if (!enrollments?.length) {
      return NextResponse.json({ error: "Bạn chưa đăng ký khóa học này" }, { status: 403 });
    }
  }

  let query = admin
    .from("lesson_questions")
    .select("id, lesson_id, user_id, content, status, created_at")
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false });

  if (!isOwnerOrAdmin) {
    query = query.eq("user_id", user.id);
  }

  const { data: questions, error } = await query;

  if (error) {
    console.error("Lesson questions GET error:", error);
    return NextResponse.json({ error: "Lỗi tải câu hỏi" }, { status: 500 });
  }

  const questionIds = (questions ?? []).map((q) => q.id);
  let replies: { lesson_question_id: string; id: string; user_id: string; content: string; created_at: string }[] = [];
  if (questionIds.length > 0) {
    const { data: reps } = await admin
      .from("lesson_question_replies")
      .select("lesson_question_id, id, user_id, content, created_at")
      .in("lesson_question_id", questionIds)
      .order("created_at", { ascending: true });
    replies = reps ?? [];
  }

  const repliesByQuestion = replies.reduce(
    (acc, r) => {
      if (!acc[r.lesson_question_id]) acc[r.lesson_question_id] = [];
      acc[r.lesson_question_id].push(r);
      return acc;
    },
    {} as Record<string, typeof replies>
  );

  const result = (questions ?? []).map((q) => ({
    ...q,
    replies: repliesByQuestion[q.id] ?? [],
  }));

  return NextResponse.json({ questions: result });
}

/**
 * POST /api/lesson-questions
 * Body: { lessonId, enrollmentId, content }
 * Student only, requires enrollment.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { lessonId, enrollmentId, content } = body;

    if (!lessonId || typeof content !== "string") {
      return NextResponse.json({ error: "lessonId và content là bắt buộc" }, { status: 400 });
    }

    const validation = validateLessonQuestionContent(content);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    const { data: lesson } = await admin
      .from("lessons")
      .select("id, chapter_id")
      .eq("id", lessonId)
      .single();
    if (!lesson?.chapter_id) {
      return NextResponse.json({ error: "Bài học không tồn tại" }, { status: 404 });
    }

    const { data: chapter } = await admin
      .from("chapters")
      .select("base_course_id")
      .eq("id", lesson.chapter_id)
      .single();
    const baseCourseId = chapter?.base_course_id;
    if (!baseCourseId) {
      return NextResponse.json({ error: "Chương không tồn tại" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role?: string } | null)?.role;
    const isOwnerOrAdmin = role === "owner" || role === "admin";

    if (!isOwnerOrAdmin) {
      if (!enrollmentId) {
        return NextResponse.json({ error: "enrollmentId là bắt buộc" }, { status: 400 });
      }
      const { data: rcList } = await admin
        .from("regular_courses")
        .select("id")
        .eq("base_course_id", baseCourseId);
      const rcIds = (rcList ?? []).map((r) => r.id);
      const { data: enrollment } = await admin
        .from("enrollments")
        .select("id")
        .eq("id", enrollmentId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .in("regular_course_id", rcIds)
        .single();
      if (!enrollment) {
        return NextResponse.json({ error: "Bạn chưa đăng ký khóa học này" }, { status: 403 });
      }
    }

    const { data: question, error } = await admin
      .from("lesson_questions")
      .insert({
        lesson_id: lessonId,
        user_id: user.id,
        content: content.trim(),
        status: "pending",
      })
      .select("id, lesson_id, content, status, created_at")
      .single();

    if (error) {
      console.error("Lesson question POST error:", error);
      return NextResponse.json({ error: "Lỗi tạo câu hỏi" }, { status: 500 });
    }

    return NextResponse.json({ question });
  } catch (err) {
    console.error("Lesson questions POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
