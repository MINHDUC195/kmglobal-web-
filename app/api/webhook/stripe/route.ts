/**
 * POST /api/webhook/stripe
 * Stripe webhook - xử lý checkout.session.completed, cập nhật payment, tạo enrollment
 * Cần cấu hình endpoint trong Stripe Dashboard trỏ tới /api/webhook/stripe
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhook } from "../../../../lib/stripe";
import { stripeSessionAmountMatchesDb } from "../../../../lib/payment-gateway-verify";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { activateEnrollmentFromPayment } from "../../../../lib/activate-enrollment-from-payment";

type PaymentRow = {
  id: string;
  user_id: string;
  metadata: { course_id?: string } | null;
  status: string;
  amount_cents: number;
};

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
      id?: string;
      amount_total?: number | null;
      metadata?: { orderId?: string; course_id?: string; user_id?: string };
    };
    const orderId = session.metadata?.orderId;
    const courseId = session.metadata?.course_id;
    const userId = session.metadata?.user_id;

    if (!orderId || !courseId || !userId) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: before, error: fetchErr } = await admin
      .from("payments")
      .select("id, user_id, amount_cents, metadata, status")
      .eq("id", orderId)
      .eq("gateway", "stripe")
      .maybeSingle();

    if (fetchErr || !before) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const row = before as PaymentRow;

    if (!stripeSessionAmountMatchesDb(session.amount_total, row.amount_cents)) {
      console.error("[payment] Stripe webhook amount mismatch (not completing)", {
        orderId,
        sessionAmountTotal: session.amount_total,
        dbAmountCents: row.amount_cents,
      });
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
    }

    const paymentMetadata = row.metadata as { course_id?: string } | null;
    if (row.user_id !== userId || paymentMetadata?.course_id !== courseId) {
      return NextResponse.json({ error: "Payment metadata mismatch" }, { status: 400 });
    }

    if (row.status !== "pending" && row.status !== "completed") {
      return NextResponse.json({ error: "Invalid payment state" }, { status: 400 });
    }

    let normalizedPayment: PaymentRow = row;

    if (row.status === "pending") {
      const { data: payment, error: pErr } = await admin
        .from("payments")
        .update({
          status: "completed",
          gateway_transaction_id: session.id ?? orderId,
          gateway_response: event.data.object as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("status", "pending")
        .eq("gateway", "stripe")
        .select("id, user_id, metadata, status")
        .single();

      if (pErr || !payment) {
        const { data: existingPayment } = await admin
          .from("payments")
          .select("id, user_id, metadata, status, amount_cents")
          .eq("id", orderId)
          .eq("gateway", "stripe")
          .maybeSingle();
        const existing = existingPayment as PaymentRow | null;
        if (!existing || existing.status !== "completed") {
          return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }
        normalizedPayment = existing;
      } else {
        normalizedPayment = payment as PaymentRow;
      }
    }

    const activated = await activateEnrollmentFromPayment(admin, orderId, userId, courseId);
    if (!activated.ok) {
      console.error("Stripe enrollment blocked:", activated.reason);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}
