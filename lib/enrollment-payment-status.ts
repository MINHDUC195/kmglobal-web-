/**
 * Trạng thái thanh toán enrollment: khóa miễn phí / đã thanh toán / cần thanh toán.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSalePriceCents } from "./course-price";

type RegularCoursePriceFields = {
  price_cents?: number | null;
  discount_percent?: number | null;
};

export async function resolveEnrollmentPaymentAccess(
  admin: SupabaseClient,
  enrollment: {
    payment_id: string | null;
    regular_course: RegularCoursePriceFields | null;
  }
): Promise<{ isFreeCourse: boolean; isPaid: boolean; needsPayment: boolean }> {
  const rc = enrollment.regular_course;
  const priceCents = Number(rc?.price_cents) || 0;
  const discountPercent = rc?.discount_percent ?? null;
  const salePriceCents = getSalePriceCents(priceCents, discountPercent);
  const isFreeCourse = salePriceCents <= 0;
  let isPaid = isFreeCourse;
  if (!isPaid && enrollment.payment_id) {
    const { data: payment } = await admin
      .from("payments")
      .select("status")
      .eq("id", enrollment.payment_id)
      .single();
    isPaid = (payment as { status?: string } | null)?.status === "completed";
  }
  const needsPayment = !isFreeCourse && !isPaid;
  return { isFreeCourse, isPaid, needsPayment };
}
