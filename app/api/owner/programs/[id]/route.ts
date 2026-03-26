/**
 * PATCH /api/owner/programs/[id] - Phê duyệt hoặc từ chối
 * DELETE /api/owner/programs/[id] - Xóa chương trình (chỉ owner)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../../lib/csrf";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  if (!(await ensureOwner(supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const action = (body as { action?: string }).action;

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action phải là 'approve' hoặc 'reject'" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: program } = await admin
    .from("programs")
    .select("id, approval_status")
    .eq("id", id)
    .single();

  if (!program) return NextResponse.json({ error: "Không tìm thấy chương trình" }, { status: 404 });

  const status = (program as { approval_status?: string }).approval_status;
  if (status !== "pending") {
    return NextResponse.json(
      { error: "Chỉ có thể phê duyệt/từ chối chương trình đang chờ phê duyệt" },
      { status: 400 }
    );
  }

  const newStatus = action === "approve" ? "approved" : "draft";
  const { error } = await admin
    .from("programs")
    .update({ approval_status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  if (!(await ensureOwner(supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("programs").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
