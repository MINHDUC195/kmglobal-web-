/**
 * PATCH /api/admin/programs/[id]
 * Admin đề xuất phê duyệt chương trình (draft -> pending)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";

async function ensureAdminOrOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  return role === "owner" || role === "admin";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  if (!(await ensureAdminOrOwner(supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const action = (body as { action?: string }).action;

  if (action !== "submit") {
    return NextResponse.json({ error: "action phải là 'submit'" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: program } = await admin
    .from("programs")
    .select("id, approval_status")
    .eq("id", id)
    .single();

  if (!program) return NextResponse.json({ error: "Không tìm thấy chương trình" }, { status: 404 });

  const status = (program as { approval_status?: string }).approval_status;
  if (status !== "draft") {
    return NextResponse.json(
      { error: "Chỉ có thể đề xuất chương trình đang phát triển" },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("programs")
    .update({ approval_status: "pending", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
