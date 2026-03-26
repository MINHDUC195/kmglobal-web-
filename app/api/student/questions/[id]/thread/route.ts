import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: questionId } = await params;
  if (!questionId) {
    return NextResponse.json({ error: "question id required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const { data: question } = await admin
    .from("lesson_questions")
    .select("id, user_id, content, created_at")
    .eq("id", questionId)
    .single();

  if (!question || question.user_id !== user.id) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const { data: rawReplies } = await admin
    .from("lesson_question_replies")
    .select("id, user_id, content, created_at")
    .eq("lesson_question_id", questionId)
    .order("created_at", { ascending: true });

  const responderIds = [...new Set((rawReplies ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
  const { data: responders } = responderIds.length
    ? await admin
        .from("profiles")
        .select("id, full_name, role")
        .in("id", responderIds)
    : { data: [] as { id: string; full_name: string | null; role: string | null }[] };
  const responderMap = new Map((responders ?? []).map((p) => [p.id, p]));

  const replies = (rawReplies ?? []).map((rep) => {
    const responder = responderMap.get(rep.user_id) as
      | { full_name?: string | null; role?: string | null }
      | undefined;
    const role = responder?.role?.trim().toLowerCase() || "student";
    const normalizedRole = role === "owner" || role === "admin" ? "admin" : "student";
    return {
      id: rep.id,
      content: rep.content,
      created_at: rep.created_at,
      responderName:
        responder?.full_name?.trim() || (normalizedRole === "admin" ? "Admin" : "Bạn"),
      responderRole: normalizedRole,
    };
  });

  return NextResponse.json(
    {
      question: {
        id: question.id,
        content: question.content,
        created_at: question.created_at,
      },
      replies,
    },
    { status: 200 }
  );
}
