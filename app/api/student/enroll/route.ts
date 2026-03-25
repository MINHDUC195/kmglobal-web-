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
import { canReactivateCanceledEnrollment } from "../../../../lib/enrollment-reactivation";
import { requireCompleteStudentProfileForApi } from "../../../../lib/student-profile-api-guard";

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

    const profileBlock = await requireCompleteStudentProfileForApi(user.id);
    if (profileBlock) return profileBlock;

    const body = await request.json();
    const courseId = (body as { courseId?: string }).courseId;
    if (!courseId) {
      return NextResponse.json({ error: "courseId là bắt buộc" }, { status: 400 });
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
      .select("id, name, base_course_id, registration_open_at, registration_close_at, course_end_at")
      .eq("id", courseId)
      .single();

    if (cErr || !course) {
      return NextResponse.json({ error: "Khóa học không tồn tại" }, { status: 404 });
    }

    const { data: existingRow } = await admin
      .from("enrollments")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("regular_course_id", courseId)
      .maybeSingle();

    const existingStatus = (existingRow as { status?: string } | null)?.status;
    if (existingStatus === "active") {
      return NextResponse.json(
        {
          error: "Bạn đã đăng ký khóa học này",
          enrollmentId: (existingRow as { id: string }).id,
        },
        { status: 200 }
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

    if (existingStatus === "cancelled" && existingRow) {
      const re = await canReactivateCanceledEnrollment(admin, user.id, courseId);
      if (!re.ok) {
        return NextResponse.json({ error: re.message }, { status: 400 });
      }
      const { error: uErr } = await admin
        .from("enrollments")
        .update({
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", (existingRow as { id: string }).id)
        .eq("user_id", user.id);

      if (uErr) {
        console.error("Enroll reactivate error:", uErr);
        return NextResponse.json({ error: "Không thể đăng ký lại. Vui lòng thử lại." }, { status: 500 });
      }

      return NextResponse.json({
        enrollmentId: (existingRow as { id: string }).id,
        redirectUrl: `/learn/${(existingRow as { id: string }).id}`,
        reactivated: true,
      });
    }

    if (existingRow) {
      return NextResponse.json(
        { error: "Bạn không thể đăng ký lại khóa này ở trạng thái hiện tại." },
        { status: 400 }
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
