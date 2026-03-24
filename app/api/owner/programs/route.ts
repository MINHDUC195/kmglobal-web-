/**
 * GET /api/owner/programs
 * Danh sách chương trình đào tạo (cho dropdown phân quyền)
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

async function ensureOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return (profile as { role?: string } | null)?.role === "owner";
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const isOwner = await ensureOwner(supabase);
  if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getSupabaseAdminClient();
  const { data: programs } = await admin
    .from("programs")
    .select("id, name, code, approval_status")
    .order("name");

  return NextResponse.json({ programs: programs ?? [] });
}
