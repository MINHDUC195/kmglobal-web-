/**
 * GET /api/owner/profile-by-email?email=
 * Tra cứu họ tên, mã HV theo email (Owner) — dùng khi import whitelist.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

async function ensureOwner() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "owner") return { ok: false as const };
  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  const auth = await ensureOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!raw || !raw.includes("@")) {
    return NextResponse.json({ found: false });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("full_name, student_code, email")
    .ilike("email", raw)
    .maybeSingle();

  if (error) {
    console.error("profile-by-email:", error.message);
    return NextResponse.json({ error: "Không tra cứu được" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ found: false });
  }

  const row = data as { full_name?: string | null; student_code?: string | null };
  return NextResponse.json({
    found: true,
    full_name: row.full_name?.trim() ?? "",
    student_code: row.student_code?.trim() ?? "",
  });
}
