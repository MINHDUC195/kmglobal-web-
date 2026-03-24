/**
 * POST /api/checkout/init
 * Body: { courseId, gateway: 'vnpay'|'momo'|'stripe' }
 * Creates pending payment, returns redirect URL
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { buildVnpayPaymentUrl } from "../../../../lib/vnpay";
import { createMomoPayment } from "../../../../lib/momo";
import { createStripeCheckout } from "../../../../lib/stripe";
import { getSalePriceCents } from "../../../../lib/course-price";
import { validateOrigin } from "../../../../lib/csrf";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../lib/rate-limit";
import {
  getCheckoutIdempotency,
  setCheckoutIdempotency,
} from "../../../../lib/checkout-idempotency";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(
    rateLimitKeyFromRequest(request, "checkout-init"),
    10,
    60_000
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429 }
    );
  }

  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, gateway, idempotencyKey } = body as {
      courseId?: string;
      gateway?: string;
      idempotencyKey?: string;
    };
    if (!courseId || !gateway) {
      return NextResponse.json({ error: "courseId and gateway required" }, { status: 400 });
    }
    if (!["vnpay", "momo", "stripe"].includes(gateway)) {
      return NextResponse.json({ error: "Invalid gateway" }, { status: 400 });
    }

    if (idempotencyKey) {
      const cached = await getCheckoutIdempotency(idempotencyKey);
      if (cached) {
        return NextResponse.json({
          redirectUrl: cached.redirectUrl,
          paymentId: cached.paymentId,
        });
      }
    }

    const admin = getSupabaseAdminClient();

    const { data: lockProfile } = await admin
      .from("profiles")
      .select("account_abuse_locked, self_temp_lock_until")
      .eq("id", user.id)
      .single();
    const lp = lockProfile as {
      account_abuse_locked?: boolean | null;
      self_temp_lock_until?: string | null;
    } | null;
    if (lp?.account_abuse_locked) {
      return NextResponse.json(
        { error: "Tài khoản của bạn đang bị khóa. Vui lòng liên hệ Owner." },
        { status: 403 }
      );
    }
    if (lp?.self_temp_lock_until && new Date(lp.self_temp_lock_until) > new Date()) {
      return NextResponse.json(
        { error: "Tài khoản đang trong thời gian tạm khóa." },
        { status: 403 }
      );
    }

    const { data: course, error: cErr } = await admin
      .from("regular_courses")
      .select("id, name, base_course_id, price_cents, discount_percent, registration_open_at, registration_close_at")
      .eq("id", courseId)
      .single();

    if (cErr || !course) {
      return NextResponse.json({ error: "Khóa học không tồn tại" }, { status: 404 });
    }

    const { data: existingSameCourse } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("regular_course_id", courseId)
      .eq("status", "active")
      .maybeSingle();
    if (existingSameCourse) {
      return NextResponse.json(
        { error: "Bạn đã đăng ký khóa học này rồi. Vào trang học để tiếp tục." },
        { status: 400 }
      );
    }

    const now = new Date();
    const openAt = course.registration_open_at ? new Date(course.registration_open_at) : null;
    const closeAt = course.registration_close_at ? new Date(course.registration_close_at) : null;
    if (openAt && now < openAt) {
      return NextResponse.json({ error: "Khóa học chưa mở đăng ký" }, { status: 400 });
    }
    if (closeAt && now > closeAt) {
      return NextResponse.json({ error: "Đã hết hạn đăng ký" }, { status: 400 });
    }

    const baseCourseId = (course as { base_course_id?: string }).base_course_id;
    if (baseCourseId) {
      const { data: rcList } = await admin
        .from("regular_courses")
        .select("id")
        .eq("base_course_id", baseCourseId);
      const rcIds = (rcList ?? []).map((r) => r.id).filter((id) => id !== courseId);
      const { data: existingSameBase } = rcIds.length
        ? await admin
            .from("enrollments")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "active")
            .in("regular_course_id", rcIds)
            .limit(1)
        : { data: [] };
      if (existingSameBase?.length) {
        return NextResponse.json(
          {
            error:
              "Bạn đã đăng ký khóa học này rồi. Nếu muốn đăng ký khóa mới, vui lòng hủy đăng ký khóa cũ trước.",
          },
          { status: 400 }
        );
      }
    }

    // price_cents: VND amount. Áp dụng giảm giá nếu có.
    const priceCents = Number(course.price_cents) || 0;
    const discountPercent = (course as { discount_percent?: number | null }).discount_percent ?? null;
    const amountCents = getSalePriceCents(priceCents, discountPercent);
    const amountVnd = amountCents;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const orderId = `KM-${Date.now()}-${user.id.slice(0, 8)}`;
    const orderInfo = `Thanh toan khoa hoc: ${(course.name as string).slice(0, 100)}`;

    const { data: payment, error: pErr } = await admin
      .from("payments")
      .insert({
        user_id: user.id,
        amount_cents: amountCents,
        currency: "VND",
        gateway,
        gateway_transaction_id: orderId,
        status: "pending",
        metadata: { course_id: courseId },
      })
      .select("id")
      .single();

    if (pErr || !payment) {
      return NextResponse.json({ error: "Không thể tạo giao dịch" }, { status: 500 });
    }

    let redirectUrl: string | null = null;

    if (gateway === "vnpay") {
      redirectUrl = buildVnpayPaymentUrl({
        amount: amountVnd || 1000,
        orderId: payment.id,
        orderInfo,
        returnUrl: `${baseUrl}/api/checkout/return/vnpay`,
      });
    } else if (gateway === "momo") {
      const momoRes = await createMomoPayment({
        amount: amountVnd || 1000,
        orderId: payment.id,
        orderInfo,
        returnUrl: `${baseUrl}/checkout/success`,
        notifyUrl: `${baseUrl}/api/webhook/momo`,
      });
      redirectUrl = momoRes?.payUrl ?? null;
    } else if (gateway === "stripe") {
      const stripeRes = await createStripeCheckout({
        amountCents: amountCents || 100000,
        currency: "vnd",
        orderId: payment.id,
        successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${baseUrl}/checkout/cancel`,
        metadata: { course_id: courseId, user_id: user.id },
      });
      redirectUrl = stripeRes?.url ?? null;
    }

    if (!redirectUrl) {
      return NextResponse.json({ error: `Cổng ${gateway} chưa được cấu hình` }, { status: 400 });
    }

    if (idempotencyKey) {
      await setCheckoutIdempotency(idempotencyKey, {
        redirectUrl,
        paymentId: payment.id,
      });
    }

    return NextResponse.json({ redirectUrl, paymentId: payment.id });
  } catch (err) {
    console.error("Checkout init error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
