import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEnrollmentPaymentAccess } from "./enrollment-payment-status";

type LessonRecord = {
  id: string;
  name: string;
  description: string | null;
  video_url: string | null;
  document_url: string | null;
  chapter_id: string;
};

type MatchedEnrollment = {
  id: string;
  payment_id: string | null;
  regular_course_id: string;
};

/**
 * Kiểm tra user có quyền xem nội dung bài học (video/PDF/metadata).
 * Dùng chung cho GET /api/lessons, signed-url Bunny, watermark PDF.
 */
export async function getLessonWithAccess(
  admin: SupabaseClient,
  userId: string,
  lessonId: string,
  enrollmentIdParam: string | null
): Promise<
  | {
      ok: true;
      lesson: LessonRecord;
      baseCourseId: string;
      isStaff: boolean;
      enrollment: MatchedEnrollment | null;
    }
  | { ok: false; status: number; message: string }
> {
  const { data: lesson, error } = await admin
    .from("lessons")
    .select("id, name, description, video_url, document_url, chapter_id")
    .eq("id", lessonId)
    .single();

  if (error || !lesson) {
    return { ok: false, status: 404, message: "Lesson not found" };
  }

  const { data: chapter } = await admin
    .from("chapters")
    .select("base_course_id")
    .eq("id", lesson.chapter_id)
    .single();
  if (!chapter?.base_course_id) {
    return { ok: false, status: 404, message: "Chapter not found" };
  }

  const baseCourseId = chapter.base_course_id as string;

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  const isStaff = role === "owner" || role === "admin";

  /** Owner/admin xem bài không ngữ cảnh học viên: không gắn enrollment (breadcrumb tối giản). */
  if (isStaff && !enrollmentIdParam) {
    return {
      ok: true,
      lesson: lesson as LessonRecord,
      baseCourseId,
      isStaff: true,
      enrollment: null,
    };
  }

  let enrollments: (MatchedEnrollment & {
    regular_course?: { base_course_id?: string; price_cents?: number | null; discount_percent?: number | null } | null;
  })[] = [];

  if (enrollmentIdParam) {
    const { data: targetEnrollment } = await admin
      .from("enrollments")
      .select(`
        id,
        payment_id,
        regular_course_id,
        regular_course:regular_courses(base_course_id, price_cents, discount_percent)
      `)
      .eq("id", enrollmentIdParam)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (targetEnrollment) {
      const targetBaseCourseId = (
        targetEnrollment as {
          regular_course?: { base_course_id?: string } | null;
        }
      ).regular_course?.base_course_id;
      if (targetBaseCourseId === baseCourseId) {
        enrollments = [targetEnrollment as typeof enrollments[number]];
      }
    }
  } else {
    const { data: regularCourses } = await admin
      .from("regular_courses")
      .select("id")
      .eq("base_course_id", baseCourseId);
    const regularCourseIds = (regularCourses ?? []).map((rc) => rc.id);
    if (regularCourseIds.length > 0) {
      const { data: matchedEnrollments } = await admin
        .from("enrollments")
        .select(`
          id,
          payment_id,
          regular_course_id,
          regular_course:regular_courses(base_course_id, price_cents, discount_percent)
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .in("regular_course_id", regularCourseIds);
      enrollments = (matchedEnrollments ?? []) as typeof enrollments;
    }
  }

  const enrollment = enrollments[0];

  if (!enrollment) {
    if (isStaff) {
      return {
        ok: true,
        lesson: lesson as LessonRecord,
        baseCourseId,
        isStaff: true,
        enrollment: null,
      };
    }
    return { ok: false, status: 403, message: "Bạn chưa đăng ký khóa học này" };
  }

  if (!isStaff) {
    const { isPaid } = await resolveEnrollmentPaymentAccess(admin, {
      payment_id: enrollment.payment_id,
      regular_course:
        (enrollment as { regular_course?: { price_cents?: number | null; discount_percent?: number | null } | null })
          .regular_course ?? null,
    });

    if (!isPaid) {
      const { data: firstChapter } = await admin
        .from("chapters")
        .select("id")
        .eq("base_course_id", baseCourseId)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      // Chương 1 (index 0) học thử; từ chương 2 trở đi cần thanh toán (khóa trả phí).
      if (firstChapter && firstChapter.id !== lesson.chapter_id) {
        return {
          ok: false,
          status: 403,
          message:
            "Bạn cần thanh toán để truy cập nội dung từ chương 2 trở đi (bao gồm bài tập).",
        };
      }
    }
  }

  return {
    ok: true,
    lesson: lesson as LessonRecord,
    baseCourseId,
    isStaff,
    enrollment,
  };
}
