/**
 * POST /api/owner/reports/payments/[id]/export-invoice
 * Đánh dấu đã xuất hóa đơn cho giao dịch.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateOrigin } from "@/lib/csrf";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  const isOwner = await ensureOwner(supabase);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Thiếu id giao dịch" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: payment, error: fetchErr } = await admin
    .from("payments")
    .select("id, status, invoice_exported_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !payment) {
    return NextResponse.json({ error: "Không tìm thấy giao dịch" }, { status: 404 });
  }

  if ((payment as { status?: string }).status !== "completed") {
    return NextResponse.json(
      { error: "Chỉ xuất hóa đơn khi thanh toán đã hoàn tất." },
      { status: 400 }
    );
  }

  if ((payment as { invoice_exported_at?: string | null }).invoice_exported_at) {
    return NextResponse.json({ success: true });
  }

  const { error } = await admin
    .from("payments")
    .update({
      invoice_exported_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
