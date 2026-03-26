import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../lib/supabase-admin";
import { isCourseExpiredUncompleted } from "../../../lib/course-expired-uncompleted";
import { resolveEnrollmentPaymentAccess } from "../../../lib/enrollment-payment-status";
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
        price_cents,
        discount_percent,
        base_course:base_courses(id, certificate_pass_percent)
      )
    `)
    .eq("id", enrollmentId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (eErr || !enrollment) notFound();

  const rc = enrollment.regular_course as {
    price_cents?: number | null;
    discount_percent?: number | null;
  } | null;
  const { isPaid, needsPayment } = await resolveEnrollmentPaymentAccess(admin, {
    payment_id: enrollment.payment_id,
    regular_course: rc ?? null,
  });

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

  const sortedChapters = [...(chapters ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const chapterIds = sortedChapters.map((c) => c.id);
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

  const lessonToChapterId = new Map(
    (allLessons ?? []).map((l) => [l.id, l.chapter_id])
  );

  let firstIncompleteLessonId: string | null = null;
  for (const ch of sortedChapters) {
    const lessons = (lessonsByChapter[ch.id] ?? []).sort((a, b) => a.sort_order - b.sort_order);
    for (const l of lessons) {
      if (!completedLessonIds.has(l.id)) {
        firstIncompleteLessonId = l.id;
        break;
      }
    }
    if (firstIncompleteLessonId) break;
  }

  const chIdxOfFirstIncomplete =
    firstIncompleteLessonId && lessonToChapterId.has(firstIncompleteLessonId)
      ? sortedChapters.findIndex((c) => c.id === lessonToChapterId.get(firstIncompleteLessonId!))
      : -1;
  const resumeBlocked = needsPayment && chIdxOfFirstIncomplete >= 1;
  const resumeLessonId = resumeBlocked ? null : firstIncompleteLessonId;

  const { data: finalExam } = await admin
    .from("final_exams")
    .select("id, name")
    .eq("base_course_id", baseCourseId)
    .limit(1)
    .single();

  const examLocked = !certificate && (await isCourseExpiredUncompleted(admin, enrollmentId));
  const finalExamBlockedByPayment = needsPayment;

  const checkoutUrl = `/checkout?courseId=${enrollment.regular_course_id}`;

  return (
    <div className="space-y-6">
      {needsPayment && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-50 px-5 py-4">
          <p className="font-semibold text-amber-900">Bạn Đang Ở Chế Độ Học Thử</p>
          <p className="mt-2 text-sm text-amber-900/90">
            Bạn đang ở chế độ học thử và bị hạn chế một số nội dung.
          </p>
          <Link
            href={checkoutUrl}
            className="mt-4 inline-block rounded-full bg-[#002b2d] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#004144]"
          >
            Nâng cấp
          </Link>
          <p className="mt-3 text-sm font-medium text-[#002b2d]">Quyền Lợi khi nâng cấp</p>
          <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
            <li>Được cấp chứng chỉ khi đạt tổng điểm khóa học ≥ {certPassThreshold}%.</li>
            <li>
              Truy cập vĩnh viễn nội dung và tài liệu của khóa học sau khi hoàn tất thanh toán.
            </li>
          </ul>
        </div>
      )}

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
          <Link
            href={`/api/student/certificates/${certificate.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[#002b2d]/30 bg-white px-5 py-2.5 text-sm font-semibold text-[#002b2d] hover:bg-[#f6f8f8]"
          >
            Tải PDF
          </Link>
        </div>
      )}

      {/* Card Tiếp tục học - edX style: white card, orange Resume button */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-[#002b2d]">Tiếp tục học</h2>
            <p className="mt-1 text-sm text-gray-600">
              {resumeBlocked
                ? "Bài học tiếp theo từ chương 2 — vui lòng dùng nút thanh toán trong khung phía trên."
                : resumeLessonId
                  ? "Nhấn nút bên cạnh để tiếp tục bài học của bạn."
                  : allChaptersComplete && !certificate
                    ? finalExamBlockedByPayment
                      ? "Bài thi cuối khóa mở sau khi bạn hoàn tất thanh toán (khung phía trên)."
                      : "Hoàn thành bài thi cuối khóa để nhận chứng chỉ."
                    : "Bạn đã hoàn thành tất cả bài học."}
            </p>
          </div>
          {resumeLessonId ? (
            <Link
              href={`/learn/preview/${resumeLessonId}?enrollmentId=${enrollmentId}`}
              className="shrink-0 rounded-full bg-[#d14d07] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#b84306]"
            >
              Tiếp tục học
            </Link>
          ) : resumeBlocked ? null : allChaptersComplete && finalExam && !certificate ? (
            examLocked ? (
              <span className="shrink-0 rounded-full border border-amber-500/50 bg-amber-50 px-6 py-2.5 text-sm font-medium text-amber-800">
                Thi cuối kỳ đã bị khóa
              </span>
            ) : finalExamBlockedByPayment ? null : (
              <Link
                href={`/learn/exam/${enrollmentId}`}
                className="shrink-0 rounded-full bg-[#002b2d] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#004144]"
              >
                Làm bài thi cuối khóa
              </Link>
            )
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
          chapters={sortedChapters}
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
            allChaptersComplete && !examLocked && !finalExamBlockedByPayment
              ? "border-[#002b2d]/30 bg-[#e6f4ea]/50"
              : "border-gray-200 bg-gray-50 opacity-90"
          }`}
        >
          <h2 className="font-semibold text-[#002b2d]">
            {finalExam.name as string}
          </h2>
          {allChaptersComplete ? (
            examLocked ? (
              <div className="mt-4">
                <p className="text-sm text-amber-700">
                  Thi cuối kỳ đã bị khóa vì khóa học đã kết thúc và bạn chưa hoàn thành đúng hạn. Bạn vẫn có thể xem nội dung nhưng không thể làm bài thi hay nhận chứng chỉ.
                </p>
              </div>
            ) : finalExamBlockedByPayment ? (
              <div className="mt-4">
                <p className="text-sm text-amber-800">
                  Bạn cần đạt {certPassThreshold}% tổng điểm để nhận được chứng chỉ.
                </p>
              </div>
            ) : (
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
            )
          ) : (
            <p className="mt-2 text-sm text-amber-600">
              {needsPayment
                ? "Hoàn thành tất cả bài học (sau khi đã thanh toán để mở từ chương 2) để mở khóa thi cuối khóa."
                : "Hoàn thành tất cả bài học để mở khóa thi cuối khóa."}
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
