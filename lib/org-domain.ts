import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureCompletedFreePaymentForCourse } from "./course-payment";

export function normalizeOrgEmailDomain(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const t = email.trim().toLowerCase();
  const at = t.lastIndexOf("@");
  if (at < 1 || at === t.length - 1) return null;
  return t.slice(at + 1).trim() || null;
}

export type OrgDomainPolicyRow = {
  id: string;
  email_domain: string;
  status: string;
  max_users: number;
  unused_expiry_years: number;
};

export type OrgDomainEntitlementRow = {
  id: string;
  policy_id: string;
  user_id: string;
  granted_at: string;
  first_used_at: string | null;
  unused_expiry_deadline: string;
  revoked_at: string | null;
};

function isEntitlementUsable(e: OrgDomainEntitlementRow, now: Date): boolean {
  if (e.revoked_at) return false;
  if (e.first_used_at) return true;
  return now.getTime() <= new Date(e.unused_expiry_deadline).getTime();
}

function addYears(isoOrDate: string | Date, years: number): Date {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : new Date(isoOrDate.getTime());
  d.setFullYear(d.getFullYear() + years);
  return d;
}

async function countPolicyEntitlements(admin: SupabaseClient, policyId: string): Promise<number> {
  const { count, error } = await admin
    .from("org_domain_entitlements")
    .select("*", { count: "exact", head: true })
    .eq("policy_id", policyId);
  if (error) {
    console.error("countPolicyEntitlements:", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Kiểm tra email đã xác nhận (Supabase Auth).
 */
export async function isAuthEmailConfirmed(
  admin: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) return false;
  return Boolean(data.user.email_confirmed_at);
}

/**
 * Trả về entitlement hiện dùng được + có cần ghi first_used sau enroll không.
 */
export async function resolveOrgDomainFreeEnrollment(
  admin: SupabaseClient,
  userId: string,
  userEmail: string | null | undefined,
  baseCourseId: string | null | undefined
): Promise<
  | { ok: false; reason: string }
  | { ok: true; entitlementId: string; policyId: string; markFirstUseAfterPayment: boolean }
> {
  if (!baseCourseId) {
    return { ok: false, reason: "no_base_course" };
  }
  const domain = normalizeOrgEmailDomain(userEmail ?? "");
  if (!domain) {
    return { ok: false, reason: "no_domain" };
  }

  const confirmed = await isAuthEmailConfirmed(admin, userId);
  if (!confirmed) {
    return { ok: false, reason: "email_not_confirmed" };
  }

  const { data: policy, error: pErr } = await admin
    .from("org_domain_policies")
    .select("id, email_domain, status, max_users, unused_expiry_years")
    .eq("email_domain", domain)
    .eq("status", "active")
    .maybeSingle();

  if (pErr || !policy) {
    return { ok: false, reason: "no_active_policy" };
  }

  const pol = policy as OrgDomainPolicyRow;

  const { data: link } = await admin
    .from("org_domain_policy_base_courses")
    .select("base_course_id")
    .eq("policy_id", pol.id)
    .eq("base_course_id", baseCourseId)
    .maybeSingle();

  if (!link) {
    return { ok: false, reason: "base_course_not_in_policy" };
  }

  const now = new Date();

  const { data: existing } = await admin
    .from("org_domain_entitlements")
    .select("id, policy_id, user_id, granted_at, first_used_at, unused_expiry_deadline, revoked_at")
    .eq("policy_id", pol.id)
    .eq("user_id", userId)
    .maybeSingle();

  const row = existing as OrgDomainEntitlementRow | null;

  if (row) {
    if (!isEntitlementUsable(row, now)) {
      return { ok: false, reason: "entitlement_expired_or_revoked" };
    }
    return {
      ok: true,
      entitlementId: row.id,
      policyId: pol.id,
      markFirstUseAfterPayment: !row.first_used_at,
    };
  }

  const used = await countPolicyEntitlements(admin, pol.id);
  if (used >= pol.max_users) {
    return { ok: false, reason: "quota_exhausted" };
  }

  const grantedAt = now.toISOString();
  const deadline = addYears(now, pol.unused_expiry_years).toISOString();

  const { data: inserted, error: insErr } = await admin
    .from("org_domain_entitlements")
    .insert({
      policy_id: pol.id,
      user_id: userId,
      granted_at: grantedAt,
      unused_expiry_deadline: deadline,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    if (String(insErr?.code) === "23505") {
      return resolveOrgDomainFreeEnrollment(admin, userId, userEmail, baseCourseId);
    }
    console.error("org_domain_entitlements insert:", insErr?.message);
    return { ok: false, reason: "claim_failed" };
  }

  return {
    ok: true,
    entitlementId: (inserted as { id: string }).id,
    policyId: pol.id,
    markFirstUseAfterPayment: true,
  };
}

export async function markOrgDomainEntitlementFirstUse(
  admin: SupabaseClient,
  entitlementId: string
): Promise<void> {
  const now = new Date().toISOString();
  await admin
    .from("org_domain_entitlements")
    .update({ first_used_at: now })
    .eq("id", entitlementId)
    .is("first_used_at", null);
}

/**
 * Tạo payment internal_free + metadata org domain; đánh dấu first_use nếu cần.
 */
export async function ensureOrgDomainFreePaymentAndMarkUse(
  admin: SupabaseClient,
  userId: string,
  courseId: string,
  entitlementId: string,
  policyId: string,
  markFirstUse: boolean
): Promise<{ paymentId: string; reused: boolean }> {
  const result = await ensureCompletedFreePaymentForCourse(admin, userId, courseId, {
    orgDomain: { entitlementId, policyId },
  });
  if (markFirstUse) {
    await markOrgDomainEntitlementFirstUse(admin, entitlementId);
  }
  return result;
}

/**
 * Hết hạn phương án A: chưa dùng và quá deadline → thu hồi tự động (không giải phóng suất).
 */
export async function revokeExpiredUnusedOrgDomainEntitlements(
  admin: SupabaseClient
): Promise<number> {
  const now = new Date().toISOString();
  const { data: rows } = await admin
    .from("org_domain_entitlements")
    .select("id")
    .is("first_used_at", null)
    .is("revoked_at", null)
    .lt("unused_expiry_deadline", now);

  const ids = (rows ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) return 0;

  const { error } = await admin
    .from("org_domain_entitlements")
    .update({
      revoked_at: now,
      revoked_reason: "Hết hạn do không sử dụng trong thời hạn cho phép",
    })
    .in("id", ids);

  if (error) {
    console.error("revokeExpiredUnusedOrgDomainEntitlements:", error.message);
    return 0;
  }
  return ids.length;
}
