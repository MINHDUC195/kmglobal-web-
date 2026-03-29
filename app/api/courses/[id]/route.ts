/**
 * GET /api/courses/[id]
 * Returns course info for checkout (name, price)
 * Public - but used after user selects course
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireCompleteStudentProfileForApi } from "../../../../lib/student-profile-api-guard";
import { getEffectiveDiscountPercent } from "../../../../lib/promotion-tiers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileBlock = await requireCompleteStudentProfileForApi(user.id);
    if (profileBlock) return profileBlock;

    const { data: course, error } = await supabase
      .from("regular_courses")
      .select(
        "id, name, price_cents, discount_percent, promotion_tiers, active_enrollment_count, registration_open_at, registration_close_at"
      )
      .eq("id", id)
      .single();

    if (error || !course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
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

    const row = course as {
      price_cents?: number | null;
      discount_percent?: number | null;
      promotion_tiers?: unknown;
      active_enrollment_count?: number;
    };
    const n = Math.max(0, Math.floor(Number(row.active_enrollment_count) || 0));
    const effective_discount_percent = getEffectiveDiscountPercent(
      row.promotion_tiers,
      row.discount_percent,
      n
    );

    return NextResponse.json({
      ...course,
      effective_discount_percent,
    });
  } catch (err) {
    console.error("Course fetch error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
