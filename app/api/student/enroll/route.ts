/**
 * POST /api/student/enroll
 * Body: { courseId }
 * Enrolls user in course without payment. User can pay later on dashboard/learn page.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../lib/csrf";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../lib/rate-limit";

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(
    rateLimitKeyFromRequest(request, "student-enroll"),
    20,
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
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Bạn cần đăng nhập để đăng ký" }, { status: 401 });
    }

    const body = await request.json();
    const courseId = (body as { courseId?: string }).courseId;
    if (!courseId) {
      return NextResponse.json({ error: "courseId là bắt buộc" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: course, error: cErr } = await admin
      .from("regular_courses")
      .select("id, name, registration_open_at, registration_close_at, course_end_at")
      .eq("id", courseId)
      .single();

    if (cErr || !course) {
      return NextResponse.json({ error: "Khóa học không tồn tại" }, { status: 404 });
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

    const { data: existing } = await admin
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("regular_course_id", courseId)
      .eq("status", "active")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Bạn đã đăng ký khóa học này", enrollmentId: existing.id },
        { status: 200 }
      );
    }

    const { data: enrollment, error: eErr } = await admin
      .from("enrollments")
      .insert({
        user_id: user.id,
        regular_course_id: courseId,
        payment_id: null,
        status: "active",
      })
      .select("id")
      .single();

    if (eErr || !enrollment) {
      console.error("Enroll insert error:", eErr);
      return NextResponse.json({ error: "Không thể đăng ký. Vui lòng thử lại." }, { status: 500 });
    }

    return NextResponse.json({
      enrollmentId: enrollment.id,
      redirectUrl: `/learn/${enrollment.id}`,
    });
  } catch (err) {
    console.error("Enroll error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
