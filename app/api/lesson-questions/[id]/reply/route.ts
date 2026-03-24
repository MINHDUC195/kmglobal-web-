import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateLessonQuestionContent } from "@/lib/lesson-question-validation";
import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/lesson-questions/[id]/reply
 * Body: { content }
 * Admin: trả lời câu hỏi. Student: trả lời thêm (thread) cho câu hỏi của mình.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;
    if (!questionId) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    if (!validateOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
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

    const rl = await checkRateLimit(`lesson-question-reply:${user.id}`, 40, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu. Thử lại sau." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const content = body?.content;
    if (typeof content !== "string") {
      return NextResponse.json({ error: "content là bắt buộc" }, { status: 400 });
    }

    const validation = validateLessonQuestionContent(content);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();

    const { data: question, error: qErr } = await admin
      .from("lesson_questions")
      .select("id, user_id, status")
      .eq("id", questionId)
      .single();

    if (qErr || !question) {
      return NextResponse.json({ error: "Câu hỏi không tồn tại" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role?: string } | null)?.role;
    const isOwnerOrAdmin = role === "owner" || role === "admin";
    const isQuestionOwner = question.user_id === user.id;

    if (!isOwnerOrAdmin && !isQuestionOwner) {
      return NextResponse.json({ error: "Bạn không có quyền trả lời câu hỏi này" }, { status: 403 });
    }

    const { data: reply, error } = await admin
      .from("lesson_question_replies")
      .insert({
        lesson_question_id: questionId,
        user_id: user.id,
        content: content.trim(),
      })
      .select("id, lesson_question_id, user_id, content, created_at")
      .single();

    if (error) {
      console.error("Lesson question reply POST error:", error);
      return NextResponse.json({ error: "Lỗi gửi trả lời" }, { status: 500 });
    }

    if (isOwnerOrAdmin && question.status === "pending") {
      await admin
        .from("lesson_questions")
        .update({ status: "answered", updated_at: new Date().toISOString() })
        .eq("id", questionId);
    }

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("Lesson question reply error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
