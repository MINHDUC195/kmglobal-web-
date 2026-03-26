import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  const { data: questions } = await admin
    .from("lesson_questions")
    .select("id")
    .eq("user_id", user.id)
    .limit(200);

  const questionIds = (questions ?? []).map((q) => q.id);
  if (!questionIds.length) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }

  const { data: replies } = await admin
    .from("lesson_question_replies")
    .select("lesson_question_id, user_id, created_at")
    .in("lesson_question_id", questionIds);
  const responderIds = [...new Set((replies ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
  const { data: responders } = responderIds.length
    ? await admin
        .from("profiles")
        .select("id, role")
        .in("id", responderIds)
    : { data: [] as { id: string; role: string | null }[] };
  const roleById = new Map(
    (responders ?? []).map((r) => [r.id, (r.role ?? "").trim().toLowerCase()])
  );

  const latestAdminReplyByQuestion = new Map<string, string>();
  for (const rep of replies ?? []) {
    const role = roleById.get(rep.user_id) ?? "";
    const isAdminReply = role === "admin" || role === "owner";
    if (!isAdminReply || !rep.created_at) continue;
    const previous = latestAdminReplyByQuestion.get(rep.lesson_question_id);
    if (!previous || Date.parse(rep.created_at) > Date.parse(previous)) {
      latestAdminReplyByQuestion.set(rep.lesson_question_id, rep.created_at);
    }
  }

  const items = [...latestAdminReplyByQuestion.entries()].map(([questionId, latestAdminReplyAt]) => ({
    questionId,
    latestAdminReplyAt,
  }));

  return NextResponse.json({ count: items.length, items }, { status: 200 });
}
