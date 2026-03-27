/**
 * GET /api/owner/whitelist-cohorts/[id]
 * PATCH /api/owner/whitelist-cohorts/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateOrigin } from "@/lib/csrf";
import { logAuditEvent } from "@/lib/audit-log";

async function ensureOwner() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, userId: "" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "owner") {
    return { ok: false as const, status: 403 as const, userId: "" };
  }
  return { ok: true as const, userId: user.id };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await ensureOwner();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const admin = getSupabaseAdminClient();

  const { data: cohort, error } = await admin
    .from("whitelist_cohorts")
    .select("id, name, status, notes, created_at, updated_at, created_by")
    .eq("id", id)
    .maybeSingle();

  if (error || !cohort) {
    return NextResponse.json({ error: "Không tìm thấy đợt" }, { status: 404 });
  }

  const { data: baseRows } = await admin
    .from("whitelist_cohort_base_courses")
    .select("base_course_id")
    .eq("cohort_id", id);

  const baseIds = (baseRows ?? []).map((r) => (r as { base_course_id: string }).base_course_id);

  const { data: members } = await admin
    .from("whitelist_members")
    .select("id, email, student_code, full_name, created_at, user_id")
    .eq("cohort_id", id)
    .order("created_at", { ascending: true })
    .limit(500);

  return NextResponse.json({
    cohort,
    base_course_ids: baseIds,
    members: members ?? [],
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const auth = await ensureOwner();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  let body: { name?: string; notes?: string | null; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (body.notes !== undefined) updates.notes = body.notes?.trim() || null;
  if (body.status === "draft" || body.status === "active" || body.status === "archived") {
    updates.status = body.status;
  }

  const admin = getSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("whitelist_cohorts")
    .update(updates)
    .eq("id", id)
    .select("id, name, status, notes, created_at, updated_at")
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Không cập nhật được đợt" }, { status: 500 });
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.whitelist_cohort.update",
    resourceType: "whitelist_cohort",
    resourceId: id,
    metadata: updates,
  });

  return NextResponse.json({ cohort: row });
}

/**
 * DELETE /api/owner/whitelist-cohorts/[id]
 * Chỉ xóa được khi chưa có bản ghi whitelist_free_grants gắn đợt (đã có suất dùng).
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const auth = await ensureOwner();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const admin = getSupabaseAdminClient();

  const { count: grantCount, error: grantErr } = await admin
    .from("whitelist_free_grants")
    .select("id", { count: "exact", head: true })
    .eq("cohort_id", id);

  if (grantErr) {
    console.error("whitelist delete grant count:", grantErr);
    return NextResponse.json({ error: "Không kiểm tra được dữ liệu" }, { status: 500 });
  }
  if ((grantCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Không xóa được đợt đã có học viên sử dụng suất miễn phí. Chuyển trạng thái sang Lưu trữ thay vì xóa.",
      },
      { status: 409 }
    );
  }

  const { error: delErr } = await admin.from("whitelist_cohorts").delete().eq("id", id);
  if (delErr) {
    console.error("whitelist_cohorts delete:", delErr);
    return NextResponse.json({ error: "Không xóa được đợt" }, { status: 500 });
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.whitelist_cohort.delete",
    resourceType: "whitelist_cohort",
    resourceId: id,
  });

  return NextResponse.json({ ok: true });
}
