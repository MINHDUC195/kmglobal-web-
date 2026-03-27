/**
 * POST /api/webhook/momo
 * MoMo IPN - nhận thông báo thanh toán, cập nhật payment, tạo enrollment
 * Phải trả về 204 trong vòng 15 giây
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyMomoIpn, type MomoIpnPayload } from "../../../../lib/momo";
import { momoIpnAmountMatchesDb } from "../../../../lib/payment-gateway-verify";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { activateEnrollmentFromPayment } from "../../../../lib/activate-enrollment-from-payment";

type PaymentRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  metadata: { course_id?: string } | null;
  status: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MomoIpnPayload;
    if (!body.orderId || body.resultCode === undefined) {
      return new NextResponse(null, { status: 400 });
    }

    const valid = await verifyMomoIpn(body);
    if (!valid) {
      return new NextResponse(null, { status: 401 });
    }

    const admin = getSupabaseAdminClient();
    const { data: before, error: fetchErr } = await admin
      .from("payments")
      .select("id, user_id, amount_cents, metadata, status")
      .eq("id", body.orderId)
      .eq("gateway", "momo")
      .maybeSingle();

    if (fetchErr || !before) {
      return new NextResponse(null, { status: 204 });
    }

    const row = before as PaymentRow;

    if (!momoIpnAmountMatchesDb(body.amount, row.amount_cents)) {
      console.error("[payment] MoMo IPN amount mismatch (not completing)", {
        orderId: body.orderId,
        ipnAmount: body.amount,
        dbAmountCents: row.amount_cents,
      });
      return new NextResponse(null, { status: 204 });
    }

    if (row.status !== "pending" && row.status !== "completed") {
      return new NextResponse(null, { status: 204 });
    }

    let normalizedPayment: PaymentRow | null = row;

    if (row.status === "pending") {
      const { data: payment, error: pErr } = await admin
        .from("payments")
        .update({
          status: "completed",
          gateway_transaction_id: String(body.transId ?? ""),
          gateway_response: body as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.orderId)
        .eq("status", "pending")
        .eq("gateway", "momo")
        .select("id, user_id, metadata, status")
        .single();

      if (pErr || !payment) {
        const { data: existingPayment } = await admin
          .from("payments")
          .select("id, user_id, metadata, status, amount_cents")
          .eq("id", body.orderId)
          .eq("gateway", "momo")
          .maybeSingle();
        const existing = existingPayment as PaymentRow | null;
        if (!existing || existing.status !== "completed") {
          return new NextResponse(null, { status: 204 });
        }
        normalizedPayment = existing;
      } else {
        normalizedPayment = payment as PaymentRow;
      }
    }

    const metadata = normalizedPayment.metadata as { course_id?: string } | null;
    const courseId = metadata?.course_id;
    if (courseId && normalizedPayment.user_id) {
      const activated = await activateEnrollmentFromPayment(
        admin,
        body.orderId,
        normalizedPayment.user_id,
        courseId
      );
      if (!activated.ok) {
        console.error("MoMo enrollment blocked:", activated.reason);
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("MoMo webhook error:", err);
    return new NextResponse(null, { status: 500 });
  }
}
