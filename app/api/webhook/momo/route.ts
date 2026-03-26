/**
 * POST /api/webhook/momo
 * MoMo IPN - nhận thông báo thanh toán, cập nhật payment, tạo enrollment
 * Phải trả về 204 trong vòng 15 giây
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyMomoIpn, type MomoIpnPayload } from "../../../../lib/momo";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { activateEnrollmentFromPayment } from "../../../../lib/activate-enrollment-from-payment";

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

    let normalizedPayment = payment as
      | { id: string; user_id: string; metadata: { course_id?: string } | null; status?: string }
      | null;
    if (pErr || !normalizedPayment) {
      const { data: existingPayment } = await admin
        .from("payments")
        .select("id, user_id, metadata, status")
        .eq("id", body.orderId)
        .eq("gateway", "momo")
        .maybeSingle();
      const existing = existingPayment as
        | { id: string; user_id: string; metadata: { course_id?: string } | null; status?: string }
        | null;
      if (!existing || existing.status !== "completed") {
        return new NextResponse(null, { status: 204 });
      }
      normalizedPayment = existing;
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
