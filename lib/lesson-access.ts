import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEnrollmentPaymentAccess } from "./enrollment-payment-status";

export type LessonRecord = {
  id: string;
  name: string;
  description: string | null;
  video_url: string | null;
  document_url: string | null;
  chapter_id: string;
};

export type MatchedEnrollment = {
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

  if (isStaff) {
    return {
      ok: true,
      lesson: lesson as LessonRecord,
      baseCourseId,
      isStaff: true,
      enrollment: null,
    };
  }

  const { data: rcList } = await admin
    .from("regular_courses")
    .select("id")
    .eq("base_course_id", baseCourseId);
  const rcIds = (rcList ?? []).map((r) => r.id);

  const { data: enrollments } = rcIds.length
    ? await admin
        .from("enrollments")
        .select(`
          id,
          payment_id,
          regular_course_id,
          regular_course:regular_courses(price_cents, discount_percent)
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .in("regular_course_id", rcIds)
    : { data: [] as (MatchedEnrollment & { regular_course?: { price_cents?: number | null; discount_percent?: number | null } | null })[] };

  const enrollment = enrollmentIdParam
    ? (enrollments ?? []).find((e) => e.id === enrollmentIdParam)
    : (enrollments ?? [])[0];

  if (!enrollment) {
    return { ok: false, status: 403, message: "Bạn chưa đăng ký khóa học này" };
  }

  const { isPaid } = await resolveEnrollmentPaymentAccess(admin, {
    payment_id: enrollment.payment_id,
    regular_course:
      (enrollment as { regular_course?: { price_cents?: number | null; discount_percent?: number | null } | null })
        .regular_course ?? null,
  });

  if (!isPaid) {
    const { data: allChapters } = await admin
      .from("chapters")
      .select("id, sort_order")
      .eq("base_course_id", baseCourseId)
      .order("sort_order", { ascending: true });
    const chapterIdsByOrder = (allChapters ?? []).map((c) => c.id);
    const chapterIndex = chapterIdsByOrder.indexOf(lesson.chapter_id);
    // Chương 1 (index 0) học thử; từ chương 2 trở đi cần thanh toán (khóa trả phí).
    if (chapterIndex >= 1) {
      return {
        ok: false,
        status: 403,
        message:
          "Bạn cần thanh toán để truy cập nội dung từ chương 2 trở đi (bao gồm bài tập).",
      };
    }
  }

  return {
    ok: true,
    lesson: lesson as LessonRecord,
    baseCourseId,
    isStaff: false,
    enrollment,
  };
}
