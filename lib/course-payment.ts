import type { SupabaseClient } from "@supabase/supabase-js";

type PaymentLite = {
  id: string;
  status: string;
  amount_cents: number;
  metadata?: { course_id?: string } | null;
  updated_at?: string | null;
};

/**
 * Tìm payment completed gần nhất cho cùng user + regular course.
 * Dùng để tránh tạo nhiều dòng thanh toán cho cùng một khóa.
 */
export async function findCompletedPaymentForCourse(
  admin: SupabaseClient,
  userId: string,
  courseId: string
): Promise<PaymentLite | null> {
  const { data, error } = await admin
    .from("payments")
    .select("id, status, amount_cents, metadata, updated_at")
    .eq("user_id", userId)
    .eq("status", "completed")
    .contains("metadata", { course_id: courseId })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("findCompletedPaymentForCourse:", error.message);
    return null;
  }
  return (data as PaymentLite | null) ?? null;
}

/**
 * Đảm bảo có payment completed 0đ cho khóa miễn phí.
 * Nếu đã có payment completed cùng user+course thì tái sử dụng.
 */
export async function ensureCompletedFreePaymentForCourse(
  admin: SupabaseClient,
  userId: string,
  courseId: string
): Promise<{ paymentId: string; reused: boolean }> {
  const existing = await findCompletedPaymentForCourse(admin, userId, courseId);
  if (existing) {
    return { paymentId: existing.id, reused: true };
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("payments")
    .insert({
      user_id: userId,
      amount_cents: 0,
      currency: "VND",
      gateway: "internal_free",
      gateway_transaction_id: `FREE-${Date.now()}-${userId.slice(0, 8)}`,
      status: "completed",
      metadata: { course_id: courseId, source: "free_enrollment" },
      updated_at: now,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(`free_payment_create_failed:${error?.message ?? "unknown"}`);
  }
  return { paymentId: data.id as string, reused: false };
}
