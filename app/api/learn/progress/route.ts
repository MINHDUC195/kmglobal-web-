/**
 * GET /api/learn/progress?enrollmentId=...
 * Trả về tiến độ: completedLessonIds, totalLessons, percentComplete
 *
 * POST /api/learn/progress
 * Body: { lessonId, enrollmentId }
 * Đánh dấu bài học đã hoàn thành
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../lib/csrf";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../lib/rate-limit";
import { requireCompleteStudentProfileForApi } from "../../../../lib/student-profile-api-guard";

export async function GET(request: NextRequest) {
  const enrollmentId = request.nextUrl.searchParams.get("enrollmentId");
  if (!enrollmentId) {
    return NextResponse.json({ error: "enrollmentId required" }, { status: 400 });
  }

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

  const profileBlockGet = await requireCompleteStudentProfileForApi(user.id);
  if (profileBlockGet) return profileBlockGet;

  const admin = getSupabaseAdminClient();

  const { data: enrollment } = await admin
    .from("enrollments")
    .select("id, user_id, regular_course_id")
    .eq("id", enrollmentId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!enrollment) {
    return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
  }

  const { data: rc } = await admin
    .from("regular_courses")
    .select("base_course_id")
    .eq("id", enrollment.regular_course_id)
    .single();
  const baseCourseId = (rc as { base_course_id?: string } | null)?.base_course_id;
  if (!baseCourseId) {
    return NextResponse.json({ completedLessonIds: [], totalLessons: 0, percentComplete: 0 });
  }

  const { data: chapters } = await admin
    .from("chapters")
    .select("id")
    .eq("base_course_id", baseCourseId);
  const chapterIds = (chapters ?? []).map((c) => c.id);
  const { data: allLessons } = chapterIds.length
    ? await admin.from("lessons").select("id").in("chapter_id", chapterIds)
    : { data: [] };
  const totalLessons = allLessons?.length ?? 0;

  const { data: progress } = await admin
    .from("lesson_progress")
    .select("lesson_id")
    .eq("enrollment_id", enrollmentId);
  const completedLessonIds = (progress ?? []).map((p) => p.lesson_id);

  const percentComplete =
    totalLessons > 0 ? Math.round((completedLessonIds.length / totalLessons) * 100) : 0;

  return NextResponse.json({
    completedLessonIds,
    totalLessons,
    percentComplete,
  });
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(
    rateLimitKeyFromRequest(request, "learn-progress"),
    120,
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileBlockPost = await requireCompleteStudentProfileForApi(user.id);
    if (profileBlockPost) return profileBlockPost;

    const body = await request.json();
    const { lessonId, enrollmentId } = body as { lessonId?: string; enrollmentId?: string };
    if (!lessonId || !enrollmentId) {
      return NextResponse.json({ error: "lessonId and enrollmentId required" }, { status: 400 });
    }

    const admin = getSupabaseAdminClient();
    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id, regular_course_id")
      .eq("id", enrollmentId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    if (!enrollment) {
      return NextResponse.json({ error: "Enrollment not found" }, { status: 404 });
    }

    const { data: rc } = await admin
      .from("regular_courses")
      .select("base_course_id")
      .eq("id", enrollment.regular_course_id)
      .single();
    const baseCourseId = (rc as { base_course_id?: string } | null)?.base_course_id;
    if (!baseCourseId) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const { data: chapters } = await admin
      .from("chapters")
      .select("id")
      .eq("base_course_id", baseCourseId);
    const chapterIds = (chapters ?? []).map((c) => c.id);
    const { data: lessonRow } = chapterIds.length
      ? await admin
          .from("lessons")
          .select("id")
          .eq("id", lessonId)
          .in("chapter_id", chapterIds)
          .single()
      : { data: null };
    if (!lessonRow) {
      return NextResponse.json({ error: "Lesson not in this course" }, { status: 400 });
    }

    await admin.from("lesson_progress").upsert(
      {
        enrollment_id: enrollmentId,
        lesson_id: lessonId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "enrollment_id,lesson_id", ignoreDuplicates: false }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Progress POST error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
