/**
 * PATCH /api/admin/course-deletion-requests/[id] — Admin/Owner hủy yêu cầu đang chờ
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { logAuditEvent } from "../../../../../lib/audit-log";
import { getStaffRole, isAdminOrOwner } from "../../../../../lib/staff-auth";
import { validateOrigin } from "../../../../../lib/csrf";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  const staff = await getStaffRole(supabase);
  if (!staff?.userId || !isAdminOrOwner(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "cancel") {
    return NextResponse.json({ error: "action phải là 'cancel'" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: row } = await admin
    .from("course_deletion_requests")
    .select("id, status, requested_by")
    .eq("id", id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404 });
  const st = (row as { status: string }).status;
  if (st !== "pending") {
    return NextResponse.json({ error: "Chỉ hủy được yêu cầu đang chờ." }, { status: 400 });
  }

  const { error } = await admin
    .from("course_deletion_requests")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    console.error("cancel deletion request:", error);
    return NextResponse.json({ error: "Không cập nhật được" }, { status: 500 });
  }

  await logAuditEvent({
    actorId: staff.userId,
    action: "course_deletion.cancelled",
    resourceType: "course_deletion_requests",
    resourceId: id,
  });

  return NextResponse.json({ ok: true });
}
