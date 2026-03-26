/**
 * POST /api/admin/course-deletion-requests — Admin/Owner đề nghị xóa.
 * Owner: tự đề nghị và tự phê duyệt (xóa ngay). Admin: tạo yêu cầu chờ Owner.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { logAuditEvent } from "../../../../lib/audit-log";
import { getStaffRole, isAdminOrOwner, isOwner } from "../../../../lib/staff-auth";
import { validateOrigin } from "../../../../lib/csrf";

export async function POST(req: NextRequest) {
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  const staff = await getStaffRole(supabase);
  if (!staff?.userId || !isAdminOrOwner(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { regular_course_id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const regularCourseId = body.regular_course_id?.trim();
  if (!regularCourseId) {
    return NextResponse.json({ error: "Thiếu regular_course_id" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { count, error: countErr } = await admin
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("regular_course_id", regularCourseId);

  if (countErr) {
    console.error("enrollments count:", countErr);
    return NextResponse.json({ error: "Không kiểm tra được đăng ký" }, { status: 500 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Không thể đề nghị xóa: đã có học viên đăng ký khóa này." },
      { status: 400 }
    );
  }

  const { data: existingPending } = await admin
    .from("course_deletion_requests")
    .select("id")
    .eq("regular_course_id", regularCourseId)
    .eq("status", "pending")
    .maybeSingle();

  if (existingPending) {
    return NextResponse.json({ error: "Đã có yêu cầu xóa đang chờ Owner phê duyệt." }, { status: 400 });
  }

  const { data: inserted, error: insErr } = await admin
    .from("course_deletion_requests")
    .insert({
      regular_course_id: regularCourseId,
      requested_by: staff.userId,
      reason: body.reason?.trim() || null,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("course_deletion_requests insert:", insErr);
    return NextResponse.json({ error: insErr?.message ?? "Không tạo được yêu cầu" }, { status: 500 });
  }

  const requestId = (inserted as { id: string }).id;

  await logAuditEvent({
    actorId: staff.userId,
    action: "course_deletion.requested",
    resourceType: "course_deletion_requests",
    resourceId: requestId,
    metadata: { regular_course_id: regularCourseId },
  });

  if (isOwner(staff.role)) {
    const { data: rpcCourseId, error: rpcErr } = await admin.rpc("approve_course_deletion_request", {
      p_request_id: requestId,
    });
    if (rpcErr) {
      const msg = rpcErr.message ?? "";
      if (msg.includes("COURSE_HAS_ENROLLMENTS") || msg.includes("enroll")) {
        return NextResponse.json(
          { error: "Không thể xóa: đã có học viên đăng ký." },
          { status: 400 }
        );
      }
      console.error("approve_course_deletion_request (owner self):", rpcErr);
      return NextResponse.json({ error: rpcErr.message ?? "Xóa thất bại" }, { status: 500 });
    }
    await logAuditEvent({
      actorId: staff.userId,
      action: "course_deletion.approved",
      resourceType: "regular_courses",
      resourceId: regularCourseId,
      metadata: { request_id: requestId, owner_self_approve: true },
    });
    return NextResponse.json({ id: requestId, deleted: true, deleted_regular_course_id: rpcCourseId });
  }

  return NextResponse.json({ id: requestId });
}
