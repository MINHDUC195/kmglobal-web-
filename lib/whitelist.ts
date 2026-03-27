import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Miễn phí theo đợt whitelist (danh sách import + base gắn cohort).
 * Owner không được hưởng; mỗi user chỉ một suất / base (bảng whitelist_free_grants).
 */
export async function resolveWhitelistFreeEnrollment(
  admin: SupabaseClient,
  userId: string,
  baseCourseId: string | null | undefined
): Promise<{ ok: false; reason: string } | { ok: true; cohortId: string }> {
  if (!baseCourseId) {
    return { ok: false, reason: "no_base_course" };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if ((profile as { role?: string } | null)?.role === "owner") {
    return { ok: false, reason: "owner_excluded" };
  }

  const { data: existingGrant } = await admin
    .from("whitelist_free_grants")
    .select("id")
    .eq("user_id", userId)
    .eq("base_course_id", baseCourseId)
    .maybeSingle();

  if (existingGrant) {
    return { ok: false, reason: "free_grant_already_used" };
  }

  const { data: members } = await admin
    .from("whitelist_members")
    .select("cohort_id")
    .eq("user_id", userId);

  const cohortIds = [...new Set((members ?? []).map((m) => (m as { cohort_id: string }).cohort_id))];
  if (cohortIds.length === 0) {
    return { ok: false, reason: "not_whitelist_member" };
  }

  const { data: activeCohorts } = await admin
    .from("whitelist_cohorts")
    .select("id")
    .in("id", cohortIds)
    .eq("status", "active");

  const activeIds = new Set((activeCohorts ?? []).map((c) => (c as { id: string }).id));

  for (const cid of cohortIds) {
    if (!activeIds.has(cid)) continue;
    const { data: link } = await admin
      .from("whitelist_cohort_base_courses")
      .select("base_course_id")
      .eq("cohort_id", cid)
      .eq("base_course_id", baseCourseId)
      .maybeSingle();
    if (link) {
      return { ok: true, cohortId: cid };
    }
  }

  return { ok: false, reason: "base_not_in_whitelist_cohort" };
}

export async function insertWhitelistFreeGrant(
  admin: SupabaseClient,
  args: {
    userId: string;
    baseCourseId: string;
    cohortId: string;
    enrollmentId: string;
    paymentId: string;
  }
): Promise<{ ok: true } | { ok: false; code: string }> {
  const { error } = await admin.from("whitelist_free_grants").insert({
    user_id: args.userId,
    base_course_id: args.baseCourseId,
    cohort_id: args.cohortId,
    enrollment_id: args.enrollmentId,
    payment_id: args.paymentId,
  });

  if (error) {
    if (String(error.code) === "23505") {
      return { ok: false, code: "duplicate_grant" };
    }
    console.error("insertWhitelistFreeGrant:", error.message);
    return { ok: false, code: "insert_failed" };
  }
  return { ok: true };
}
