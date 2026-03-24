/**
 * POST /api/webhook/stripe
 * Stripe webhook - xử lý checkout.session.completed, cập nhật payment, tạo enrollment
 * Cần cấu hình endpoint trong Stripe Dashboard trỏ tới /api/webhook/stripe
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhook } from "../../../../lib/stripe";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { assertEnrollmentCanActivateAfterPayment } from "../../../../lib/enrollment-payment-activate";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const payload = await request.text();
    const event = await verifyStripeWebhook(payload, signature);
    if (!event) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object as {
      metadata?: { orderId?: string; course_id?: string; user_id?: string };
    };
    const orderId = session.metadata?.orderId;
    const courseId = session.metadata?.course_id;
    const userId = session.metadata?.user_id;

    if (!orderId || !courseId || !userId) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: payment, error: pErr } = await admin
      .from("payments")
      .update({
        status: "completed",
        gateway_transaction_id: (event.data.object as { id?: string })?.id ?? orderId,
        gateway_response: event.data.object as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("status", "pending")
      .eq("gateway", "stripe")
      .select("user_id")
      .single();

    if (pErr || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const gate = await assertEnrollmentCanActivateAfterPayment(admin, userId, courseId);
    if (!gate.ok) {
      console.error("Stripe enrollment blocked:", gate.reason);
    } else {
      await admin.from("enrollments").upsert(
        {
          user_id: userId,
          regular_course_id: courseId,
          payment_id: orderId,
          status: "active",
        },
        { onConflict: "user_id,regular_course_id", ignoreDuplicates: false }
      );
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
