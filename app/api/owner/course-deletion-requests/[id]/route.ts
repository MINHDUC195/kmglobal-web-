/**
 * PATCH /api/owner/course-deletion-requests/[id] — Phê duyệt hoặc từ chối xóa khóa (owner)
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { logAuditEvent } from "../../../../../lib/audit-log";
import { getStaffRole, isOwner } from "../../../../../lib/staff-auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const staff = await getStaffRole(supabase);
  if (!staff?.userId || !isOwner(staff.role)) {
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

  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action phải là 'approve' hoặc 'reject'" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: reqRow } = await admin
    .from("course_deletion_requests")
    .select(
      `
      id,
      status,
      regular_course_id,
      regular_course:regular_courses(id, name)
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (!reqRow) return NextResponse.json({ error: "Không tìm thấy yêu cầu" }, { status: 404 });

  const st = (reqRow as { status: string }).status;
  if (st !== "pending") {
    return NextResponse.json({ error: "Yêu cầu không còn ở trạng thái chờ." }, { status: 400 });
  }

  const courseId = (reqRow as { regular_course_id: string }).regular_course_id;
  const courseName =
    (reqRow as { regular_course?: { name?: string } | null }).regular_course?.name ?? courseId;

  if (action === "reject") {
    const { error } = await admin
      .from("course_deletion_requests")
      .update({
        status: "rejected",
        reviewed_by: staff.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending");

    if (error) {
      console.error("reject deletion:", error);
      return NextResponse.json({ error: "Không cập nhật được" }, { status: 500 });
    }

    await logAuditEvent({
      actorId: staff.userId,
      action: "course_deletion.rejected",
      resourceType: "course_deletion_requests",
      resourceId: id,
      metadata: { regular_course_id: courseId, course_name: courseName },
    });

    return NextResponse.json({ ok: true });
  }

  // approve — RPC xóa khóa (atomic, chặn nếu có enrollment)
  const { data: rpcCourseId, error: rpcErr } = await admin.rpc("approve_course_deletion_request", {
    p_request_id: id,
  });

  if (rpcErr) {
    const msg = rpcErr.message ?? "";
    if (msg.includes("COURSE_HAS_ENROLLMENTS") || msg.includes("enroll")) {
      return NextResponse.json(
        { error: "Không thể xóa: đã có học viên đăng ký (dữ liệu thay đổi sau khi đề nghị)." },
        { status: 400 }
      );
    }
    console.error("approve_course_deletion_request:", rpcErr);
    return NextResponse.json({ error: rpcErr.message ?? "Phê duyệt thất bại" }, { status: 500 });
  }

  await logAuditEvent({
    actorId: staff.userId,
    action: "course_deletion.approved",
    resourceType: "regular_courses",
    resourceId: courseId,
    metadata: { request_id: id, course_name: courseName, deleted_id: rpcCourseId },
  });

  return NextResponse.json({ ok: true, deleted_regular_course_id: rpcCourseId });
}
