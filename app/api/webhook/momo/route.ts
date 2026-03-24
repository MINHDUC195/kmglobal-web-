/**
 * POST /api/webhook/momo
 * MoMo IPN - nhận thông báo thanh toán, cập nhật payment, tạo enrollment
 * Phải trả về 204 trong vòng 15 giây
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyMomoIpn, type MomoIpnPayload } from "../../../../lib/momo";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

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
      .select("user_id, metadata")
      .single();

    if (pErr || !payment) {
      return new NextResponse(null, { status: 204 });
    }

    const metadata = payment.metadata as { course_id?: string } | null;
    const courseId = metadata?.course_id;
    if (courseId) {
      await admin.from("enrollments").upsert(
        {
          user_id: payment.user_id,
          regular_course_id: courseId,
          payment_id: body.orderId,
          status: "active",
        },
        { onConflict: "user_id,regular_course_id", ignoreDuplicates: false }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("MoMo webhook error:", err);
    return new NextResponse(null, { status: 500 });
  }
}
