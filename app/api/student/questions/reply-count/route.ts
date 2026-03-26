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
    .select("lesson_question_id")
    .in("lesson_question_id", questionIds);

  const repliedQuestionCount = new Set((replies ?? []).map((r) => r.lesson_question_id)).size;
  return NextResponse.json({ count: repliedQuestionCount }, { status: 200 });
}
