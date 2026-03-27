import type { SupabaseClient } from "@supabase/supabase-js";
import { getSalePriceCents } from "./course-price";
import { ensureCompletedFreePaymentForCourse } from "./course-payment";
import { insertWhitelistFreeGrant } from "./whitelist";

/**
 * Khi học viên đã đăng ký regular course (chưa thanh toán / chờ) mà sau đó được thêm vào whitelist
 * cùng base — gắn thanh toán hoàn tất 0đ + grant. Không đụng giao dịch đã hoàn tất có số tiền > 0.
 */
async function enrollmentEligibleForWhitelistConversion(
  admin: SupabaseClient,
  paymentId: string | null
): Promise<boolean> {
  if (!paymentId) return true;
  const { data: pay } = await admin
    .from("payments")
    .select("status, amount_cents")
    .eq("id", paymentId)
    .maybeSingle();
  if (!pay) return true;
  const st = (pay as { status?: string }).status;
  const cents = Number((pay as { amount_cents?: number }).amount_cents) || 0;
  if (st === "completed" && cents > 0) return false;
  return true;
}

/**
 * Áp whitelist cho một đợt vừa thêm thành viên (hoặc đợt vừa kích hoạt): các enrollment active
 * trùng base trong đợt, còn nợ tiền hoặc chưa có grant.
 */
export async function applyWhitelistAfterMemberAdded(
  admin: SupabaseClient,
  userId: string,
  cohortId: string
): Promise<{ applied: number }> {
  const { data: cohort } = await admin
    .from("whitelist_cohorts")
    .select("id, status, applies_from, applies_until")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohort || (cohort as { status?: string }).status !== "active") {
    return { applied: 0 };
  }

  const appliesFrom = (cohort as { applies_from?: string | null }).applies_from;
  const appliesUntil = (cohort as { applies_until?: string | null }).applies_until;
  const now = Date.now();
  if (appliesFrom && new Date(appliesFrom).getTime() > now) return { applied: 0 };
  if (appliesUntil && new Date(appliesUntil).getTime() < now) return { applied: 0 };

  const { data: bases } = await admin
    .from("whitelist_cohort_base_courses")
    .select("base_course_id")
    .eq("cohort_id", cohortId);
  const baseSet = new Set((bases ?? []).map((b) => (b as { base_course_id: string }).base_course_id));

  if (baseSet.size === 0) return { applied: 0 };

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("id, payment_id, regular_course_id")
    .eq("user_id", userId)
    .eq("status", "active");

  const enList = enrollments ?? [];
  const rcIds = [...new Set(enList.map((e) => (e as { regular_course_id: string }).regular_course_id))];
  const { data: coursesBatch } = rcIds.length
    ? await admin
        .from("regular_courses")
        .select("id, base_course_id, price_cents, discount_percent")
        .in("id", rcIds)
    : { data: [] as { id: string; base_course_id: string | null; price_cents: number | null; discount_percent: number | null }[] };
  const courseById = new Map((coursesBatch ?? []).map((c) => [c.id, c]));

  const { data: grantRows } = await admin
    .from("whitelist_free_grants")
    .select("base_course_id")
    .eq("user_id", userId);
  const grantedBases = new Set(
    (grantRows ?? []).map((g) => (g as { base_course_id: string }).base_course_id)
  );

  let applied = 0;

  for (const en of enList) {
    const courseId = (en as { regular_course_id: string }).regular_course_id;
    const course = courseById.get(courseId);
    if (!course) continue;
    const baseId = course.base_course_id;
    if (!baseId || !baseSet.has(baseId)) continue;

    const priceCents = Number(course.price_cents) || 0;
    const discountPercent = course.discount_percent ?? null;
    const saleCents = getSalePriceCents(priceCents, discountPercent);
    if (saleCents <= 0) continue;

    if (grantedBases.has(baseId)) continue;

    const paymentId = (en as { payment_id: string | null }).payment_id;
    const eligible = await enrollmentEligibleForWhitelistConversion(admin, paymentId);
    if (!eligible) continue;

    const fp = await ensureCompletedFreePaymentForCourse(admin, userId, courseId, {
      whitelist: { cohortId },
    });

    const { error: upErr } = await admin
      .from("enrollments")
      .update({
        payment_id: fp.paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (en as { id: string }).id)
      .eq("user_id", userId);

    if (upErr) {
      console.error("whitelist reconcile enrollment update:", upErr.message);
      continue;
    }

    const g = await insertWhitelistFreeGrant(admin, {
      userId,
      baseCourseId: baseId,
      cohortId,
      enrollmentId: (en as { id: string }).id,
      paymentId: fp.paymentId,
    });
    if (g.ok || g.code === "duplicate_grant") {
      applied += 1;
      grantedBases.add(baseId);
    }
  }

  return { applied };
}

/** Gọi sau khi học viên vào dashboard: thử áp mọi đợt whitelist đang hiệu lực mà user thuộc. */
export async function syncWhitelistEnrollmentsForUser(
  admin: SupabaseClient,
  userId: string
): Promise<{ applied: number }> {
  const { data: members } = await admin
    .from("whitelist_members")
    .select("cohort_id")
    .eq("user_id", userId);

  const cohortIds = [...new Set((members ?? []).map((m) => (m as { cohort_id: string }).cohort_id))];
  let total = 0;
  for (const cid of cohortIds) {
    const r = await applyWhitelistAfterMemberAdded(admin, userId, cid);
    total += r.applied;
  }
  return { applied: total };
}
