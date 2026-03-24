/**
 * GET /api/admin/question-library/list?q=...&programId=...
 * Danh sách câu hỏi cho admin (để gắn vào bài thi, v.v.)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { HIDE_FROM_LIBRARY_TAG } from "../../../../../lib/question-tags";

export async function GET(request: NextRequest) {
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

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  const programId = request.nextUrl.searchParams.get("programId") || "";

  const admin = getSupabaseAdminClient();

  let query = admin
    .from("questions")
    .select("id, content, type, points, tags")
    .order("created_at", { ascending: false })
    .limit(50);

  if (programId) query = query.eq("program_id", programId);
  if (q) query = query.ilike("content", `%${q}%`);

  const { data: raw } = await query;

  const questions = (raw ?? [])
    .filter((q) => !(q as { tags?: string[] | null }).tags?.includes(HIDE_FROM_LIBRARY_TAG))
    .map(({ id, content, type, points }) => ({ id, content, type, points }));

  return NextResponse.json({ questions });
}
