/**
 * POST /api/student/enrollments/[id]/cancel
 * Hủy đăng ký: đếm lần hủy, cảnh báo/email từ lần 3, lần 5 + đã TT → xóa dữ liệu học;
 * lần 5 + chưa TT → khóa tài khoản (Owner mở).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../../../lib/csrf";
import {
  deleteLearningDataForEnrollment,
  incrementEnrollmentCancelCount,
  paymentIsCompleted,
} from "../../../../../../lib/enrollment-cancel";
import { cancelWarningEmailHtml, sendKmgEmail } from "../../../../../../lib/email-notify";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const { id: enrollmentId } = await context.params;
  if (!enrollmentId) {
    return NextResponse.json({ error: "enrollmentId required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  const { data: enrollment, error: fetchErr } = await admin
    .from("enrollments")
    .select("id, user_id, status, payment_id, regular_course_id")
    .eq("id", enrollmentId)
    .single();

  if (fetchErr || !enrollment) {
    return NextResponse.json({ error: "Không tìm thấy đăng ký" }, { status: 404 });
  }

  if (enrollment.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (enrollment.status !== "active") {
    return NextResponse.json({ error: "Đăng ký đã bị hủy trước đó" }, { status: 400 });
  }

  const regularCourseId = enrollment.regular_course_id as string;
  const { data: course, error: cErr } = await admin
    .from("regular_courses")
    .select("id, name, base_course_id")
    .eq("id", regularCourseId)
    .single();

  if (cErr || !course) {
    return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });
  }

  const baseCourseId = (course as { base_course_id?: string | null }).base_course_id;
  const courseName = (course as { name?: string }).name ?? "Khóa học";

  let cancelCount: number;
  try {
    cancelCount = await incrementEnrollmentCancelCount(admin, user.id, regularCourseId);
  } catch {
    return NextResponse.json({ error: "Không thể cập nhật thống kê hủy" }, { status: 500 });
  }

  const paid = await paymentIsCompleted(admin, enrollment.payment_id as string | null);

  let learningDataCleared = false;
  let accountLocked = false;

  if (cancelCount === 5 && paid) {
    if (baseCourseId) {
      await deleteLearningDataForEnrollment(
        admin,
        user.id,
        enrollmentId,
        baseCourseId
      );
      learningDataCleared = true;
    }
  }

  if (cancelCount === 5 && !paid) {
    const { error: lockErr } = await admin
      .from("profiles")
      .update({
        account_abuse_locked: true,
        abuse_locked_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (lockErr) {
      console.error("Abuse lock profile error:", lockErr);
      return NextResponse.json({ error: "Không thể hoàn tất hủy đăng ký" }, { status: 500 });
    }
    accountLocked = true;
  }

  const { error: updateErr } = await admin
    .from("enrollments")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)
    .eq("user_id", user.id);

  if (updateErr) {
    console.error("Cancel enrollment error:", updateErr);
    return NextResponse.json({ error: "Không thể hủy đăng ký" }, { status: 500 });
  }

  if (cancelCount >= 3 && cancelCount < 5) {
    const { data: prof } = await admin
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .single();
    const email = (prof as { email?: string | null } | null)?.email;
    if (email) {
      void sendKmgEmail({
        to: email,
        subject: `[KM Global] Cảnh báo: hủy đăng ký lần ${cancelCount}`,
        html: cancelWarningEmailHtml(
          (prof as { full_name?: string | null })?.full_name ?? null,
          courseName,
          cancelCount
        ),
      });
    }
  }

  let warningLevel: "third" | "fourth" | null = null;
  if (cancelCount === 3) warningLevel = "third";
  if (cancelCount === 4) warningLevel = "fourth";

  return NextResponse.json({
    success: true,
    cancelCount,
    warningLevel,
    learningDataCleared,
    accountLocked,
  });
}
