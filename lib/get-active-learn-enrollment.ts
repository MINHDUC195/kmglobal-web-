import { cache } from "react";
import { getSupabaseAdminClient } from "./supabase-admin";

/** Một query gộp cho layout + page `/learn/[enrollmentId]` — React.cache tránh gọi DB hai lần trong cùng request. */
export type ActiveLearnEnrollmentRow = {
  id: string;
  payment_id: string | null;
  regular_course_id: string | null;
  regular_course: {
    id: string;
    name: string;
    price_cents: number | null;
    discount_percent: number | null;
    registration_close_at: string | null;
    course_end_at: string | null;
    base_course: {
      id: string;
      certificate_pass_percent: number | null;
      final_exam_weight_percent: number | null;
      name: string | null;
      code: string | null;
      summary: string | null;
      objectives: string | null;
      difficulty_level: string | null;
      prerequisite: string | null;
    } | null;
  } | null;
};

export const getActiveLearnEnrollmentForUser = cache(
  async (
    enrollmentId: string,
    userId: string
  ): Promise<ActiveLearnEnrollmentRow | null> => {
    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from("enrollments")
      .select(
        `
      id,
      payment_id,
      regular_course_id,
      regular_course:regular_courses(
        id,
        name,
        price_cents,
        discount_percent,
        registration_close_at,
        course_end_at,
        base_course:base_courses(
          id,
          certificate_pass_percent,
          final_exam_weight_percent,
          name,
          code,
          summary,
          objectives,
          difficulty_level,
          prerequisite
        )
      )
    `
      )
      .eq("id", enrollmentId)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (error || !data) return null;
    return data as unknown as ActiveLearnEnrollmentRow;
  }
);
