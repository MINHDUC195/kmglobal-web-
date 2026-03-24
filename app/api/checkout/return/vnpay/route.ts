/**
 * GET /api/checkout/return/vnpay?vnpay_query_params
 * VNPay redirects user here after payment
 * Verify signature, update payment, create enrollment, redirect to learn
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyVnpayReturn } from "../../../../../lib/vnpay";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const params: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    params[k] = v;
  });

  if (!verifyVnpayReturn(params)) {
    return NextResponse.redirect(new URL("/checkout/failed?reason=invalid_signature", request.url));
  }

  const vnp_ResponseCode = params.vnp_ResponseCode;
  const vnp_TxnRef = params.vnp_TxnRef; // payment id
  const vnp_TransactionNo = params.vnp_TransactionNo;

  if (vnp_ResponseCode !== "00") {
    return NextResponse.redirect(new URL("/checkout/failed?reason=payment_failed", request.url));
  }

  const admin = getSupabaseAdminClient();
  const { data: payment, error: pErr } = await admin
    .from("payments")
    .update({
      status: "completed",
      gateway_transaction_id: vnp_TransactionNo,
      gateway_response: params,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vnp_TxnRef)
    .eq("gateway", "vnpay")
    .eq("status", "pending")
    .select("user_id, metadata")
    .single();

  if (pErr || !payment) {
    return NextResponse.redirect(new URL("/checkout/failed?reason=update_failed", request.url));
  }

  const metadata = payment.metadata as { course_id?: string } | null;
  const courseId = metadata?.course_id;
  if (courseId) {
    await admin.from("enrollments").upsert(
      {
        user_id: payment.user_id,
        regular_course_id: courseId,
        payment_id: vnp_TxnRef,
        status: "active",
      },
      { onConflict: "user_id,regular_course_id", ignoreDuplicates: false }
    );
  }

  const { data: enrollment } = courseId
    ? await admin
        .from("enrollments")
        .select("id")
        .eq("user_id", payment.user_id)
        .eq("regular_course_id", courseId)
        .single()
    : { data: null };

  const baseUrl = request.nextUrl.origin;
  const redirect =
    enrollment?.id
      ? `${baseUrl}/learn/${enrollment.id}`
      : `${baseUrl}/student`;

  return NextResponse.redirect(redirect);
}
