/**
 * GET /api/checkout/return/vnpay?vnpay_query_params
 * VNPay redirects user here after payment
 * Verify signature, update payment, create enrollment, redirect to learn
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyVnpayReturn } from "../../../../../lib/vnpay";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { activateEnrollmentFromPayment } from "../../../../../lib/activate-enrollment-from-payment";

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
    .select("id, user_id, metadata, status")
    .single();

  let normalizedPayment = payment as
    | { id: string; user_id: string; metadata: { course_id?: string } | null; status?: string }
    | null;

  if (pErr || !normalizedPayment) {
    // Idempotent refresh/retry: payment may already be completed.
    const { data: existingPayment } = await admin
      .from("payments")
      .select("id, user_id, metadata, status")
      .eq("id", vnp_TxnRef)
      .eq("gateway", "vnpay")
      .maybeSingle();
    const existing = existingPayment as
      | { id: string; user_id: string; metadata: { course_id?: string } | null; status?: string }
      | null;
    if (!existing || existing.status !== "completed") {
      return NextResponse.redirect(new URL("/checkout/failed?reason=update_failed", request.url));
    }
    normalizedPayment = existing;
  }

  const metadata = normalizedPayment.metadata as { course_id?: string } | null;
  const courseId = metadata?.course_id;
  let enrollmentId: string | null = null;
  if (courseId && normalizedPayment.user_id) {
    const activated = await activateEnrollmentFromPayment(
      admin,
      vnp_TxnRef,
      normalizedPayment.user_id,
      courseId
    );
    if (!activated.ok) {
      console.error("VNPay enrollment blocked:", activated.reason);
      return NextResponse.redirect(
        new URL(`/checkout/failed?reason=enrollment_blocked`, request.url)
      );
    }
    enrollmentId = activated.enrollmentId;
  }

  const baseUrl = request.nextUrl.origin;
  const redirect =
    enrollmentId
      ? `${baseUrl}/learn/${enrollmentId}`
      : `${baseUrl}/student`;

  return NextResponse.redirect(redirect);
}
