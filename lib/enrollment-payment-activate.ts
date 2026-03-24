/**
 * Kích hoạt enrollment sau thanh toán (upsert) — chặn nếu đã hủy quá 5 lần / ngoài điều kiện đăng ký lại.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { canReactivateCanceledEnrollment } from "./enrollment-reactivation";

export async function assertEnrollmentCanActivateAfterPayment(
  admin: SupabaseClient,
  userId: string,
  courseId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: row } = await admin
    .from("enrollments")
    .select("id, status")
    .eq("user_id", userId)
    .eq("regular_course_id", courseId)
    .maybeSingle();

  if (!row) return { ok: true };

  const st = (row as { status?: string }).status;
  if (st === "active") return { ok: true };

  if (st === "cancelled") {
    const r = await canReactivateCanceledEnrollment(admin, userId, courseId);
    if (!r.ok) return { ok: false, reason: r.message };
    return { ok: true };
  }

  return { ok: true };
}
