/**
 * PATCH /api/owner/org-domain-entitlements/[id]
 * Gia hạn unused_expiry_deadline hoặc thu hồi sớm (revoked_at).
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
  if (!user) return { ok: false as const, userId: "" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "owner") {
    return { ok: false as const, userId: "" };
  }
  return { ok: true as const, userId: user.id };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const auth = await ensureOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  }

  let body: {
    unused_expiry_deadline?: string | null;
    revoke?: boolean;
    revoke_reason?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: row, error: fErr } = await admin
    .from("org_domain_entitlements")
    .select("id, revoked_at")
    .eq("id", id)
    .maybeSingle();

  if (fErr || !row) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }

  if ((row as { revoked_at?: string | null }).revoked_at && body.unused_expiry_deadline !== undefined) {
    return NextResponse.json({ error: "Đã thu hồi, không gia hạn được" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.revoke === true) {
    updates.revoked_at = new Date().toISOString();
    updates.revoked_reason = body.revoke_reason?.trim() || "Thu hồi bởi Owner";
    updates.revoked_by = auth.userId;
  }

  if (body.unused_expiry_deadline !== undefined && body.revoke !== true) {
    const raw = body.unused_expiry_deadline;
    if (raw === null || raw === "") {
      return NextResponse.json({ error: "unused_expiry_deadline không hợp lệ" }, { status: 400 });
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "unused_expiry_deadline không phải ngày hợp lệ" }, { status: 400 });
    }
    updates.unused_expiry_deadline = d.toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Không có thay đổi" }, { status: 400 });
  }

  const { error: uErr } = await admin.from("org_domain_entitlements").update(updates).eq("id", id);
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.org_domain_entitlement.update",
    resourceType: "org_domain_entitlements",
    resourceId: id,
    metadata: { keys: Object.keys(updates) },
  });

  return NextResponse.json({ ok: true });
}
