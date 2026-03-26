import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getLessonWithAccess } from "@/lib/lesson-access";
import { requireCompleteStudentProfileForApi } from "@/lib/student-profile-api-guard";

/**
 * GET /api/lessons/[id]
 * Returns lesson (name, description, video_url, document_url)
 * Requires: authenticated user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
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

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileBlock = await requireCompleteStudentProfileForApi(user.id);
    if (profileBlock) return profileBlock;

    const admin = getSupabaseAdminClient();
    const enrollmentIdParam = request.nextUrl.searchParams.get("enrollmentId");

    const access = await getLessonWithAccess(admin, user.id, id, enrollmentIdParam);
    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }

    const { lesson, isStaff, enrollment } = access;

    if (
      !isStaff &&
      enrollment &&
      enrollmentIdParam &&
      enrollment.id === enrollmentIdParam
    ) {
      const [chapterFullRes, chapterLessonsRes, rcWithNameRes, progressRowsRes] =
        await Promise.all([
          admin
            .from("chapters")
            .select("id, name, sort_order")
            .eq("id", lesson.chapter_id)
            .single(),
          admin
            .from("lessons")
            .select("id, name, sort_order")
            .eq("chapter_id", lesson.chapter_id)
            .order("sort_order", { ascending: true }),
          admin
            .from("regular_courses")
            .select("name, base_course_id")
            .eq("id", enrollment.regular_course_id)
            .single(),
          admin
            .from("lesson_progress")
            .select("lesson_id")
            .eq("enrollment_id", enrollmentIdParam),
        ]);

      const chapterFull = chapterFullRes.data;
      const chapterLessons = chapterLessonsRes.data;
      const rcWithName = rcWithNameRes.data;
      const progressRows = progressRowsRes.data;

      let programName: string | null = null;
      const baseCourseIdFromCourse = (rcWithName as { base_course_id?: string | null } | null)?.base_course_id;
      if (baseCourseIdFromCourse) {
        const { data: baseCourse } = await admin
          .from("base_courses")
          .select("program_id")
          .eq("id", baseCourseIdFromCourse)
          .single();
        const programId = (baseCourse as { program_id?: string | null } | null)?.program_id;
        if (programId) {
          const { data: program } = await admin
            .from("programs")
            .select("name")
            .eq("id", programId)
            .single();
          programName = (program as { name?: string | null } | null)?.name?.trim() ?? null;
        }
      }

      const completedLessonIds = (progressRows ?? []).map((p) => p.lesson_id);
      const sortedLessons = (chapterLessons ?? []).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      const currentIndex = sortedLessons.findIndex((l) => l.id === lesson.id);
      const prevLesson = currentIndex > 0 ? sortedLessons[currentIndex - 1] : null;
      const nextLesson =
        currentIndex >= 0 && currentIndex < sortedLessons.length - 1
          ? sortedLessons[currentIndex + 1]
          : null;

      return NextResponse.json({
        id: lesson.id,
        name: lesson.name,
        description: lesson.description,
        video_url: lesson.video_url,
        document_url: lesson.document_url,
        courseName: (rcWithName as { name?: string } | null)?.name ?? "Khóa học",
        programName,
        chapter: chapterFull
          ? { id: chapterFull.id, name: chapterFull.name, sort_order: chapterFull.sort_order }
          : null,
        chapterLessons: sortedLessons.map((l) => ({
          id: l.id,
          name: l.name,
          sort_order: l.sort_order,
        })),
        prevLessonId: prevLesson?.id ?? null,
        nextLessonId: nextLesson?.id ?? null,
        completedLessonIds,
      });
    }

    return NextResponse.json({
      id: lesson.id,
      name: lesson.name,
      description: lesson.description,
      video_url: lesson.video_url,
      document_url: lesson.document_url,
    });
  } catch (err) {
    console.error("Lesson fetch error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
