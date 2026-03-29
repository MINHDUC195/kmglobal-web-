/**
 * GET /api/owner/regular-courses — Danh sách khóa học thường (phê duyệt hiển thị)
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

async function ensureOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return (profile as { role?: string } | null)?.role === "owner";
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  if (!(await ensureOwner(supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data: courses, error } = await admin
    .from("regular_courses")
    .select(
      `
      id,
      name,
      approval_status,
      created_at,
      program:programs(id, name),
      base_course:base_courses(id, name, code)
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("owner regular-courses list:", error.message);
    return NextResponse.json({ error: "Không tải được danh sách" }, { status: 500 });
  }

  return NextResponse.json({ courses: courses ?? [] });
}
