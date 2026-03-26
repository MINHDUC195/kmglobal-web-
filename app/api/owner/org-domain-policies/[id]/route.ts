/**
 * GET / PATCH /api/owner/org-domain-policies/[id]
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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await ensureOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: policy, error } = await admin
    .from("org_domain_policies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !policy) {
    return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
  }

  const { data: links } = await admin
    .from("org_domain_policy_base_courses")
    .select("base_course_id")
    .eq("policy_id", id);

  const baseIds = (links ?? []).map((r) => (r as { base_course_id: string }).base_course_id);

  const { count } = await admin
    .from("org_domain_entitlements")
    .select("*", { count: "exact", head: true })
    .eq("policy_id", id);

  const { data: entRows } = await admin
    .from("org_domain_entitlements")
    .select("id, user_id, granted_at, first_used_at, unused_expiry_deadline, revoked_at, revoked_reason")
    .eq("policy_id", id)
    .order("granted_at", { ascending: true });

  const uids = [...new Set((entRows ?? []).map((r) => (r as { user_id: string }).user_id))];
  const emailById: Record<string, string | null> = {};
  if (uids.length > 0) {
    const { data: profs } = await admin.from("profiles").select("id, email").in("id", uids);
    for (const p of profs ?? []) {
      emailById[(p as { id: string }).id] = (p as { email: string | null }).email ?? null;
    }
  }

  const entitlements = (entRows ?? []).map((r) => {
    const row = r as {
      id: string;
      user_id: string;
      granted_at: string;
      first_used_at: string | null;
      unused_expiry_deadline: string;
      revoked_at: string | null;
      revoked_reason: string | null;
    };
    return {
      ...row,
      email: emailById[row.user_id] ?? null,
    };
  });

  return NextResponse.json({
    policy,
    base_course_ids: baseIds,
    seats_used: count ?? 0,
    entitlements,
  });
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
    status?: string;
    max_users?: number;
    unused_expiry_years?: number;
    notes?: string | null;
    base_course_ids?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!["draft", "active", "suspended"].includes(body.status)) {
      return NextResponse.json({ error: "status không hợp lệ" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (body.max_users !== undefined) {
    const n = Number(body.max_users);
    if (!Number.isFinite(n) || n < 1 || n > 100000) {
      return NextResponse.json({ error: "max_users không hợp lệ" }, { status: 400 });
    }
    updates.max_users = n;
  }
  if (body.unused_expiry_years !== undefined) {
    const y = Number(body.unused_expiry_years);
    if (!Number.isFinite(y) || y < 1 || y > 50) {
      return NextResponse.json({ error: "unused_expiry_years không hợp lệ" }, { status: 400 });
    }
    updates.unused_expiry_years = y;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes?.trim() || null;
  }

  if (Object.keys(updates).length > 1) {
    const { error: uErr } = await admin.from("org_domain_policies").update(updates).eq("id", id);
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }
  }

  if (Array.isArray(body.base_course_ids)) {
    const baseIds = [...new Set(body.base_course_ids.filter((x) => typeof x === "string" && x.trim()))];
    if (baseIds.length === 0) {
      return NextResponse.json({ error: "Cần ít nhất một base_course_id" }, { status: 400 });
    }
    await admin
      .from("org_domain_policies")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);
    await admin.from("org_domain_policy_base_courses").delete().eq("policy_id", id);
    const { error: linkErr } = await admin
      .from("org_domain_policy_base_courses")
      .insert(baseIds.map((base_course_id) => ({ policy_id: id, base_course_id })));
    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.org_domain_policy.update",
    resourceType: "org_domain_policies",
    resourceId: id,
    metadata: { keys: Object.keys(body) },
  });

  return NextResponse.json({ ok: true });
}
