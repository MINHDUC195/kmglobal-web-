/**
 * GET /api/owner/org-domain-policies
 * POST /api/owner/org-domain-policies
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateOrigin } from "@/lib/csrf";
import { logAuditEvent } from "@/lib/audit-log";

const BLOCKED_PUBLIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

async function ensureOwner() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, userId: "", user: null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "owner") {
    return { ok: false as const, userId: "", user: null };
  }
  return { ok: true as const, userId: user.id, user };
}

function normalizeDomain(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t || t.includes("@") || t.includes(" ") || t.length > 200) return null;
  return t;
}

/** Bảng chưa tạo / schema cache PostgREST sau migration. */
function isMissingOrgRelation(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message || "").toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    err.code === "42P01" ||
    err.code === "PGRST205"
  );
}

export async function GET() {
  const auth = await ensureOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("org_domain_policies")
    .select("id, email_domain, status, max_users, unused_expiry_years, notes, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("org_domain_policies list:", error);
    if (isMissingOrgRelation(error)) {
      return NextResponse.json({
        policies: [],
        warning:
          "CSDL chưa có bảng miễn phí theo domain. Trên Supabase, chạy migration: supabase/migrations/20260328120000_org_domain_entitlements.sql (SQL Editor hoặc supabase db push).",
      });
    }
    return NextResponse.json({ error: "Không tải được danh sách" }, { status: 500 });
  }

  const policies = rows ?? [];
  const counts: Record<string, number> = {};
  for (const p of policies) {
    const pid = (p as { id: string }).id;
    const { count, error: cErr } = await admin
      .from("org_domain_entitlements")
      .select("*", { count: "exact", head: true })
      .eq("policy_id", pid);
    if (cErr && !isMissingOrgRelation(cErr)) {
      console.error("org_domain_entitlements count:", cErr);
    }
    counts[pid] = cErr && !isMissingOrgRelation(cErr) ? 0 : count ?? 0;
  }

  return NextResponse.json({
    policies: policies.map((p) => ({
      ...(p as object),
      seats_used: counts[(p as { id: string }).id] ?? 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const auth = await ensureOwner();
  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    email_domain?: string;
    max_users?: number;
    unused_expiry_years?: number;
    status?: string;
    notes?: string | null;
    base_course_ids?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const domain = normalizeDomain(body.email_domain ?? "");
  if (!domain) {
    return NextResponse.json({ error: "Tên miền email không hợp lệ (vd. congty.com.vn)" }, { status: 400 });
  }
  if (BLOCKED_PUBLIC_DOMAINS.has(domain)) {
    return NextResponse.json({ error: "Không thể dùng tên miền email công cộng phổ biến." }, { status: 400 });
  }

  const maxUsers = Number(body.max_users);
  if (!Number.isFinite(maxUsers) || maxUsers < 1 || maxUsers > 100000) {
    return NextResponse.json({ error: "max_users phải từ 1 đến 100000" }, { status: 400 });
  }

  const years = Number(body.unused_expiry_years ?? 3);
  if (!Number.isFinite(years) || years < 1 || years > 50) {
    return NextResponse.json({ error: "unused_expiry_years phải từ 1 đến 50" }, { status: 400 });
  }

  const status = body.status === "active" || body.status === "draft" || body.status === "suspended" ? body.status : "draft";

  const baseIds = Array.isArray(body.base_course_ids)
    ? [...new Set(body.base_course_ids.filter((id) => typeof id === "string" && id.trim()))]
    : [];
  if (baseIds.length === 0) {
    return NextResponse.json({ error: "Chọn ít nhất một khóa học cơ bản (base course)" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: inserted, error: insErr } = await admin
    .from("org_domain_policies")
    .insert({
      email_domain: domain,
      status,
      max_users: maxUsers,
      unused_expiry_years: years,
      notes: body.notes?.trim() || null,
      created_by: auth.userId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    if (String(insErr?.code) === "23505") {
      return NextResponse.json({ error: "Tên miền này đã tồn tại." }, { status: 409 });
    }
    console.error("org_domain_policies insert:", insErr);
    return NextResponse.json({ error: insErr?.message ?? "Không tạo được" }, { status: 500 });
  }

  const policyId = (inserted as { id: string }).id;

  const { error: linkErr } = await admin.from("org_domain_policy_base_courses").insert(
    baseIds.map((base_course_id) => ({ policy_id: policyId, base_course_id }))
  );

  if (linkErr) {
    await admin.from("org_domain_policies").delete().eq("id", policyId);
    console.error("org_domain_policy_base_courses insert:", linkErr);
    return NextResponse.json({ error: "Không gắn được khóa học cơ bản" }, { status: 500 });
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.org_domain_policy.create",
    resourceType: "org_domain_policies",
    resourceId: policyId,
    metadata: { email_domain: domain, base_course_count: baseIds.length },
  });

  return NextResponse.json({ id: policyId });
}
