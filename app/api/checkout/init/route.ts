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
import { requireCompleteStudentProfileForApi } from "../../../../lib/student-profile-api-guard";
import { ensureCompletedFreePaymentForCourse } from "../../../../lib/course-payment";
import { assertEnrollmentCanActivateAfterPayment } from "../../../../lib/enrollment-payment-activate";
import { insertWhitelistFreeGrant, resolveWhitelistFreeEnrollment } from "../../../../lib/whitelist";
import {
  isRoleBlockedFromSelfServiceEnrollment,
  jsonSelfServiceEnrollmentForbidden,
} from "../../../../lib/self-service-enrollment";

/** Khi migration `checkout_course_id` chưa áp trên Supabase, PostgREST báo lỗi cột / schema cache. */
function isMissingCheckoutCourseIdColumn(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? "").toLowerCase();
  return (
    msg.includes("checkout_course_id") ||
    (msg.includes("schema cache") && msg.includes("payments"))
  );
}

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
    const userId = user.id;

    const profileBlock = await requireCompleteStudentProfileForApi(userId);
    if (profileBlock) return profileBlock;

    const admin = getSupabaseAdminClient();
    const { data: checkoutRoleRow } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    const checkoutRole = (checkoutRoleRow as { role?: string } | null)?.role;
    if (isRoleBlockedFromSelfServiceEnrollment(checkoutRole)) {
      return jsonSelfServiceEnrollmentForbidden();
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
    const normalizedCourseId = courseId;
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

    const { data: lockProfile } = await admin
      .from("profiles")
      .select("account_abuse_locked, self_temp_lock_until")
      .eq("id", userId)
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
      .eq("user_id", userId)
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
            .eq("user_id", userId)
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

    if (amountCents > 0 && baseCourseId) {
      const wl = await resolveWhitelistFreeEnrollment(admin, userId, baseCourseId);
      if (wl.ok) {
        const gate = await assertEnrollmentCanActivateAfterPayment(admin, userId, normalizedCourseId);
        if (!gate.ok) {
          return NextResponse.json({ error: gate.reason }, { status: 400 });
        }
        const freePayment = await ensureCompletedFreePaymentForCourse(admin, userId, normalizedCourseId, {
          whitelist: { cohortId: wl.cohortId },
        });
        await admin.from("enrollments").upsert(
          {
            user_id: userId,
            regular_course_id: normalizedCourseId,
            payment_id: freePayment.paymentId,
            status: "active",
          },
          { onConflict: "user_id,regular_course_id", ignoreDuplicates: false }
        );
        const { data: enrollment } = await admin
          .from("enrollments")
          .select("id")
          .eq("user_id", userId)
          .eq("regular_course_id", normalizedCourseId)
          .single();
        if (enrollment?.id) {
          const g = await insertWhitelistFreeGrant(admin, {
            userId,
            baseCourseId,
            cohortId: wl.cohortId,
            enrollmentId: enrollment.id,
            paymentId: freePayment.paymentId,
          });
          if (!g.ok && g.code !== "duplicate_grant") {
            console.error("checkout whitelist grant:", g.code);
          }
        }
        const redirectUrl = enrollment?.id ? `${baseUrl}/learn/${enrollment.id}` : `${baseUrl}/student`;
        return NextResponse.json({
          redirectUrl,
          paymentId: freePayment.paymentId,
          free: true,
          whitelist: true,
        });
      }
    }

    if (amountCents <= 0) {
      const gate = await assertEnrollmentCanActivateAfterPayment(admin, userId, normalizedCourseId);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.reason }, { status: 400 });
      }
      const freePayment = await ensureCompletedFreePaymentForCourse(admin, userId, normalizedCourseId);
      await admin.from("enrollments").upsert(
        {
          user_id: userId,
          regular_course_id: normalizedCourseId,
          payment_id: freePayment.paymentId,
          status: "active",
        },
        { onConflict: "user_id,regular_course_id", ignoreDuplicates: false }
      );
      const { data: enrollment } = await admin
        .from("enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("regular_course_id", normalizedCourseId)
        .single();
      const redirectUrl = enrollment?.id ? `${baseUrl}/learn/${enrollment.id}` : `${baseUrl}/student`;
      return NextResponse.json({ redirectUrl, paymentId: freePayment.paymentId, free: true });
    }

    const orderId = `KM-${Date.now()}-${userId.slice(0, 8)}`;
    const orderInfo = `Thanh toan khoa hoc: ${(course.name as string).slice(0, 100)}`;

    async function buildGatewayRedirect(paymentId: string): Promise<string | null> {
      if (gateway === "vnpay") {
        return buildVnpayPaymentUrl({
          amount: amountVnd || 1000,
          orderId: paymentId,
          orderInfo,
          returnUrl: `${baseUrl}/api/checkout/return/vnpay`,
        });
      }
      if (gateway === "momo") {
        const momoRes = await createMomoPayment({
          amount: amountVnd || 1000,
          orderId: paymentId,
          orderInfo,
          returnUrl: `${baseUrl}/checkout/success`,
          notifyUrl: `${baseUrl}/api/webhook/momo`,
        });
        return momoRes?.payUrl ?? null;
      }
      if (gateway === "stripe") {
        const stripeRes = await createStripeCheckout({
          amountCents: amountCents || 100000,
          currency: "vnd",
          orderId: paymentId,
          successUrl: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${baseUrl}/checkout/cancel`,
          metadata: { course_id: normalizedCourseId, user_id: userId },
        });
        return stripeRes?.url ?? null;
      }
      return null;
    }

    let existingPendingPayment: { id: string } | null = null;
    {
      const r1 = await admin
        .from("payments")
        .select("id")
        .eq("user_id", userId)
        .eq("gateway", gateway)
        .eq("status", "pending")
        .eq("checkout_course_id", normalizedCourseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (r1.error && isMissingCheckoutCourseIdColumn(r1.error)) {
        const r2 = await admin
          .from("payments")
          .select("id")
          .eq("user_id", userId)
          .eq("gateway", gateway)
          .eq("status", "pending")
          .contains("metadata", { course_id: normalizedCourseId })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (r2.error) console.error("checkout init existing pending (metadata):", r2.error);
        existingPendingPayment = r2.data;
      } else if (r1.error) {
        console.error("checkout init existing pending:", r1.error);
      } else {
        existingPendingPayment = r1.data;
      }
    }
    if (existingPendingPayment?.id) {
      const redirectUrl = await buildGatewayRedirect(existingPendingPayment.id);
      if (!redirectUrl) {
        return NextResponse.json({ error: `Cổng ${gateway} chưa được cấu hình` }, { status: 400 });
      }
      if (idempotencyKey) {
        await setCheckoutIdempotency(idempotencyKey, {
          redirectUrl,
          paymentId: existingPendingPayment.id,
        });
      }
      return NextResponse.json({ redirectUrl, paymentId: existingPendingPayment.id, reused: true });
    }

    const insertBase = {
      user_id: userId,
      amount_cents: amountCents,
      currency: "VND",
      gateway,
      gateway_transaction_id: orderId,
      status: "pending",
      metadata: { course_id: normalizedCourseId },
    };

    let { data: payment, error: pErr } = await admin
      .from("payments")
      .insert({
        ...insertBase,
        checkout_course_id: normalizedCourseId,
      })
      .select("id")
      .single();

    if (pErr && isMissingCheckoutCourseIdColumn(pErr)) {
      ({ data: payment, error: pErr } = await admin
        .from("payments")
        .insert(insertBase)
        .select("id")
        .single());
    }

    let resolvedPaymentId = payment?.id as string | undefined;

    if (pErr?.code === "23505") {
      const ar1 = await admin
        .from("payments")
        .select("id")
        .eq("user_id", userId)
        .eq("gateway", gateway)
        .eq("status", "pending")
        .eq("checkout_course_id", normalizedCourseId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let afterRace = ar1.data;
      if (ar1.error && isMissingCheckoutCourseIdColumn(ar1.error)) {
        const ar2 = await admin
          .from("payments")
          .select("id")
          .eq("user_id", userId)
          .eq("gateway", gateway)
          .eq("status", "pending")
          .contains("metadata", { course_id: normalizedCourseId })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        afterRace = ar2.data;
      }
      resolvedPaymentId = afterRace?.id as string | undefined;
    }

    if (!resolvedPaymentId) {
      if (pErr && pErr.code !== "23505") {
        console.error("Checkout init insert payment:", pErr);
      }
      return NextResponse.json({ error: "Không thể tạo giao dịch" }, { status: 500 });
    }

    let redirectUrl: string | null = null;

    redirectUrl = await buildGatewayRedirect(resolvedPaymentId);

    if (!redirectUrl) {
      return NextResponse.json({ error: `Cổng ${gateway} chưa được cấu hình` }, { status: 400 });
    }

    if (idempotencyKey) {
      await setCheckoutIdempotency(idempotencyKey, {
        redirectUrl,
        paymentId: resolvedPaymentId,
      });
    }

    const raced = Boolean(pErr?.code === "23505");
    return NextResponse.json({
      redirectUrl,
      paymentId: resolvedPaymentId,
      ...(raced ? { reused: true } : {}),
    });
  } catch (err) {
    console.error("Checkout init error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
