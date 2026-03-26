import type { SupabaseClient } from "@supabase/supabase-js";
import { assertEnrollmentCanActivateAfterPayment } from "./enrollment-payment-activate";

export async function activateEnrollmentFromPayment(
  admin: SupabaseClient,
  paymentId: string,
  userId: string,
  courseId: string
): Promise<{ ok: true; enrollmentId: string | null } | { ok: false; reason: string }> {
  const gate = await assertEnrollmentCanActivateAfterPayment(admin, userId, courseId);
  if (!gate.ok) {
    return { ok: false, reason: gate.reason };
  }

  const { error: upsertErr } = await admin.from("enrollments").upsert(
    {
      user_id: userId,
      regular_course_id: courseId,
      payment_id: paymentId,
      status: "active",
    },
    { onConflict: "user_id,regular_course_id", ignoreDuplicates: false }
  );
  if (upsertErr) {
    return { ok: false, reason: "ENROLLMENT_UPSERT_FAILED" };
  }

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("regular_course_id", courseId)
    .maybeSingle();

  return { ok: true, enrollmentId: enrollment?.id ?? null };
}
