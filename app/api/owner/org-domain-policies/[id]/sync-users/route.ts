/**
 * POST /api/owner/org-domain-policies/[id]/sync-users
 * Cấp suất cho user đã có trong hệ thống (email trùng domain), theo thứ tự created_at, đến khi đủ quota.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateOrigin } from "@/lib/csrf";
import { isAuthEmailConfirmed } from "@/lib/org-domain";
import { logAuditEvent } from "@/lib/audit-log";
import { isOrgDomainSchemaMissingError, orgDomainSchemaMissingJsonResponse } from "@/lib/org-domain-schema-error";

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

function addYears(d: Date, years: number): Date {
  const x = new Date(d.getTime());
  x.setFullYear(x.getFullYear() + years);
  return x;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const auth = await ensureOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: policyId } = await params;
  if (!policyId) {
    return NextResponse.json({ error: "Thiếu id" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: policy, error: pErr } = await admin
    .from("org_domain_policies")
    .select("id, email_domain, max_users, unused_expiry_years, status")
    .eq("id", policyId)
    .maybeSingle();

  if (pErr) {
    if (isOrgDomainSchemaMissingError(pErr)) {
      return orgDomainSchemaMissingJsonResponse();
    }
    return NextResponse.json({ error: "Không tìm thấy policy" }, { status: 404 });
  }
  if (!policy) {
    return NextResponse.json({ error: "Không tìm thấy policy" }, { status: 404 });
  }

  const pol = policy as {
    email_domain: string;
    max_users: number;
    unused_expiry_years: number;
    status: string;
  };

  if (pol.status !== "active") {
    return NextResponse.json({ error: "Chỉ đồng bộ khi policy đang active" }, { status: 400 });
  }

  const { count: usedCount } = await admin
    .from("org_domain_entitlements")
    .select("*", { count: "exact", head: true })
    .eq("policy_id", policyId);

  const used = usedCount ?? 0;
  let remaining = pol.max_users - used;
  if (remaining <= 0) {
    return NextResponse.json({ assigned: 0, message: "Đã đủ quota" });
  }

  const suffix = `@${pol.email_domain}`;
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("id, email, created_at")
    .ilike("email", `%${suffix}`)
    .order("created_at", { ascending: true, nullsFirst: true });

  if (profErr) {
    console.error("sync-users profiles:", profErr);
    return NextResponse.json({ error: "Không đọc được profiles" }, { status: 500 });
  }

  let assigned = 0;
  const now = new Date();

  for (const row of profiles ?? []) {
    if (remaining <= 0) break;
    const uid = (row as { id: string }).id;
    const email = (row as { email: string | null }).email;

    const { data: existing } = await admin
      .from("org_domain_entitlements")
      .select("id")
      .eq("policy_id", policyId)
      .eq("user_id", uid)
      .maybeSingle();
    if (existing) continue;

    const okEmail = email?.toLowerCase().endsWith(suffix.toLowerCase());
    if (!okEmail) continue;

    const confirmed = await isAuthEmailConfirmed(admin, uid);
    if (!confirmed) continue;

    const grantedAt = now.toISOString();
    const deadline = addYears(now, pol.unused_expiry_years).toISOString();

    const { error: insErr } = await admin.from("org_domain_entitlements").insert({
      policy_id: policyId,
      user_id: uid,
      granted_at: grantedAt,
      unused_expiry_deadline: deadline,
    });

    if (insErr) {
      if (String(insErr.code) === "23505") continue;
      console.error("sync-users insert:", insErr);
      continue;
    }
    assigned += 1;
    remaining -= 1;
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.org_domain_policy.sync_users",
    resourceType: "org_domain_policies",
    resourceId: policyId,
    metadata: { assigned },
  });

  return NextResponse.json({ assigned, remaining_slots: remaining });
}
