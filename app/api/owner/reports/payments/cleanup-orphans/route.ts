/**
 * POST /api/owner/reports/payments/cleanup-orphans
 * Xóa các bản ghi payments có user_id = NULL (user đã xóa trong Auth).
 * Chỉ owner. enrollments.payment_id được set null theo FK.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

async function ensureOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return (profile as { role?: string } | null)?.role === "owner";
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const isOwner = await ensureOwner(supabase);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.from("payments").delete().is("user_id", null).select("id");

  if (error) {
    console.error("cleanup-orphans payments:", error);
    return NextResponse.json({ error: "Không thể xóa giao dịch." }, { status: 500 });
  }

  const deleted = data?.length ?? 0;
  return NextResponse.json({ ok: true, deleted });
}
