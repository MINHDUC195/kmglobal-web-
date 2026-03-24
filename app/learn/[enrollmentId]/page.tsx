import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../lib/supabase-admin";
import ProgressBar from "../../../components/ProgressBar";
import LearnCourseAccordion from "./LearnCourseAccordion";

export const dynamic = "force-dynamic";

type LearnPageProps = {
  params: Promise<{ enrollmentId: string }>;
};

export default async function LearnPage({ params }: LearnPageProps) {
  const { enrollmentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const admin = getSupabaseAdminClient();
  const { data: enrollment, error: eErr } = await admin
    .from("enrollments")
    .select(`
      id,
      payment_id,
      regular_course_id,
      regular_course:regular_courses(
        id,
        name,
        base_course:base_courses(id, certificate_pass_percent)
      )
    `)
    .eq("id", enrollmentId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (eErr || !enrollment) notFound();

  let isPaid = false;
  if (enrollment.payment_id) {
    const { data: payment } = await admin
      .from("payments")
      .select("status")
      .eq("id", enrollment.payment_id)
      .single();
    isPaid = (payment as { status?: string } | null)?.status === "completed";
  }

  const baseCourse = (enrollment.regular_course as {
    base_course?: { id?: string; certificate_pass_percent?: number | null };
  } | null)?.base_course;
  const baseCourseId = baseCourse?.id;
  if (!baseCourseId) notFound();

  const rawCert = baseCourse?.certificate_pass_percent;
  const certPassThreshold = Math.round(
    rawCert != null && !Number.isNaN(Number(rawCert)) ? Number(rawCert) : 70
  );

  // Chỉ hiện banner chứng chỉ khi đã có bản ghi certificates cho enrollment
  const { data: certificate } = await admin
    .from("certificates")
    .select("id, code")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();

  const { data: chapters } = await admin
    .from("chapters")
    .select("id, name, sort_order")
    .eq("base_course_id", baseCourseId)
    .order("sort_order");

  const chapterIds = (chapters ?? []).map((c) => c.id);
  const { data: allLessons } = chapterIds.length
    ? await admin
        .from("lessons")
        .select("id, chapter_id, name, sort_order")
        .in("chapter_id", chapterIds)
    : { data: [] as { id: string; chapter_id: string; name: string; sort_order: number }[] };

  const lessonsByChapter = (allLessons ?? []).reduce(
    (acc, l) => {
      if (!acc[l.chapter_id]) acc[l.chapter_id] = [];
      acc[l.chapter_id].push({ id: l.id, name: l.name, sort_order: l.sort_order });
      return acc;
    },
    {} as Record<string, { id: string; name: string; sort_order: number }[]>
  );

  const totalLessons = allLessons?.length ?? 0;
  const { data: progressRows } = await admin
    .from("lesson_progress")
    .select("lesson_id")
    .eq("enrollment_id", enrollmentId);
  const completedLessonIds = new Set((progressRows ?? []).map((p) => p.lesson_id));
  const completedCount = completedLessonIds.size;
  const allChaptersComplete =
    totalLessons > 0 && completedCount >= totalLessons;

  // Tìm bài học đầu tiên chưa hoàn thành để hiển thị Resume
  let firstIncompleteLessonId: string | null = null;
  for (const ch of chapters ?? []) {
    const lessons = (lessonsByChapter[ch.id] ?? []).sort((a, b) => a.sort_order - b.sort_order);
    for (const l of lessons) {
      if (!completedLessonIds.has(l.id)) {
        firstIncompleteLessonId = l.id;
        break;
      }
    }
    if (firstIncompleteLessonId) break;
  }

  const { data: finalExam } = await admin
    .from("final_exams")
    .select("id, name")
    .eq("base_course_id", baseCourseId)
    .limit(1)
    .single();

  const checkoutUrl = `/checkout?courseId=${enrollment.regular_course_id}`;

  return (
    <div className="space-y-6">
      {/* Banner chứng chỉ - CHỈ hiện khi đã hoàn thành khóa học và đủ điều kiện (có bản ghi certificate) */}
      {certificate && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#22c55e]/30 bg-[#e6f4ea] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-white">✓</span>
            <div>
              <p className="font-semibold text-[#002b2d]">
                Chúc mừng! Chứng chỉ của bạn đã sẵn sàng.
              </p>
              <p className="mt-0.5 text-sm text-gray-600">
                Mã: <span className="font-mono text-[#002b2d]">{certificate.code}</span>
              </p>
            </div>
          </div>
          <Link
            href={`/verify?code=${encodeURIComponent(certificate.code)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#002b2d] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#004144]"
          >
            Xem chứng chỉ
          </Link>
        </div>
      )}

      {/* Card Tiếp tục học - edX style: white card, orange Resume button */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[#002b2d]">Tiếp tục học</h2>
            <p className="mt-1 text-sm text-gray-600">
              {firstIncompleteLessonId
                ? "Nhấn nút bên cạnh để tiếp tục bài học của bạn."
                : allChaptersComplete && !certificate
                  ? "Hoàn thành bài thi cuối khóa để nhận chứng chỉ."
                  : "Bạn đã hoàn thành tất cả bài học."}
            </p>
          </div>
          {firstIncompleteLessonId ? (
            <Link
              href={`/learn/preview/${firstIncompleteLessonId}?enrollmentId=${enrollmentId}`}
              className="shrink-0 rounded-full bg-[#d14d07] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#b84306]"
            >
              Tiếp tục học
            </Link>
          ) : allChaptersComplete && finalExam && !certificate ? (
            <Link
              href={`/learn/exam/${enrollmentId}`}
              className="shrink-0 rounded-full bg-[#002b2d] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#004144]"
            >
              Làm bài thi cuối khóa
            </Link>
          ) : null}
        </div>
      </div>

      {totalLessons > 0 && (
        <ProgressBar
          completed={completedCount}
          total={totalLessons}
          label="Tiến độ"
          variant="light"
          className="rounded-xl border border-gray-200 bg-gray-50 p-4"
        />
      )}

      <div>
        <h2 className="mb-4 font-semibold text-[#002b2d]">Nội dung khóa học</h2>
        <LearnCourseAccordion
          chapters={chapters ?? []}
          lessonsByChapter={lessonsByChapter}
          completedLessonIds={Array.from(completedLessonIds)}
          enrollmentId={enrollmentId}
          isPaid={isPaid}
          checkoutUrl={checkoutUrl}
        />
      </div>

      {finalExam && (
        <div
          className={`rounded-xl border p-6 ${
            allChaptersComplete
              ? "border-[#002b2d]/30 bg-[#e6f4ea]/50"
              : "border-gray-200 bg-gray-50 opacity-90"
          }`}
        >
          <h2 className="font-semibold text-[#002b2d]">
            {finalExam.name as string}
          </h2>
          {allChaptersComplete ? (
            <div className="mt-4">
              <p className="text-sm text-gray-600">
                Bạn đã hoàn thành tất cả bài học. Nhấn nút bên dưới để làm bài thi cuối khóa (chứng chỉ khi điểm tổng khóa đạt ≥ {certPassThreshold}%).
              </p>
              <Link
                href={`/learn/exam/${enrollmentId}`}
                className="mt-4 inline-block rounded-full bg-[#002b2d] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#004144]"
              >
                Làm bài thi cuối khóa
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-600">
              Hoàn thành tất cả bài học để mở khóa thi cuối khóa.
            </p>
          )}
        </div>
      )}

      {(!chapters || chapters.length === 0) && (
        <p className="text-gray-600">Khóa học chưa có nội dung.</p>
      )}

      <Link
        href="/student"
        className="inline-block rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-[#002b2d] hover:bg-gray-50"
      >
        Về Dashboard
      </Link>
    </div>
  );
}
