import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../lib/supabase-admin";
import { getSalePriceCents } from "../../lib/course-price";
import { resolveEnrollmentPaymentAccess } from "../../lib/enrollment-payment-status";
import { loadLessonQuestionsForStudent } from "../../lib/lesson-questions-student";
import ProgressBar from "../../components/ProgressBar";
import SelfTempLockSection from "../../components/SelfTempLockSection";
import { daysUntil } from "../../lib/course-lifecycle";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  const { data: enrollments } = await admin
    .from("enrollments")
    .select(
      `
      id,
      enrolled_at,
      payment_id,
      regular_course_id,
      regular_courses(id, name, price_cents, discount_percent, registration_close_at, course_end_at, base_course:base_courses(id))
    `
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("enrolled_at", { ascending: false });

  const list: Array<{
    id: string;
    courseName: string;
    enrolledAt: string | null;
    completedCount: number;
    totalLessons: number;
    needsPayment: boolean;
    salePriceCents: number;
    courseId: string;
    daysUntilRegClose: number | null;
    daysUntilCourseEnd: number | null;
  }> = [];

  for (const e of enrollments ?? []) {
    const baseCourseId = (e.regular_courses as { base_course?: { id?: string } } | null)?.base_course?.id;
    let totalLessons = 0;
    if (baseCourseId) {
      const { data: chapters } = await admin
        .from("chapters")
        .select("id")
        .eq("base_course_id", baseCourseId);
      const chapterIds = (chapters ?? []).map((c) => c.id);
      if (chapterIds.length > 0) {
        const { count } = await admin
          .from("lessons")
          .select("id", { count: "exact", head: true })
          .in("chapter_id", chapterIds);
        totalLessons = count ?? 0;
      }
    }
    const { data: progressRows } = await admin
      .from("lesson_progress")
      .select("lesson_id")
      .eq("enrollment_id", e.id);
    const completedCount = progressRows?.length ?? 0;

    const rc = e.regular_courses as {
      price_cents?: number | null;
      discount_percent?: number | null;
      registration_close_at?: string | null;
      course_end_at?: string | null;
    } | null;
    const priceCents = Number(rc?.price_cents) || 0;
    const discountPercent = rc?.discount_percent ?? null;
    const salePriceCents = getSalePriceCents(priceCents, discountPercent);
    const { needsPayment } = await resolveEnrollmentPaymentAccess(admin, {
      payment_id: e.payment_id,
      regular_course: rc ?? null,
    });
    list.push({
      id: e.id,
      courseName: (e.regular_courses as { name?: string } | null)?.name ?? "Khóa học",
      enrolledAt: e.enrolled_at,
      completedCount,
      totalLessons,
      needsPayment,
      salePriceCents,
      courseId: e.regular_course_id,
      daysUntilRegClose: daysUntil(rc?.registration_close_at ?? null),
      daysUntilCourseEnd: daysUntil(rc?.course_end_at ?? null),
    });
  }

  const lessonQuestions = await loadLessonQuestionsForStudent(user.id);

  const { data: anyPaid } = await admin
    .from("payments")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();
  const hasPaidBefore = Boolean(anyPaid);

  return (
    <>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Dashboard Học viên
      </h1>
      <p className="mt-2 text-gray-400">
        Các khóa học bạn đã đăng ký và đang theo học.
      </p>

      {list.length > 0 ? (
        <div className="mt-8 space-y-4">
          {list.map((e) => (
            <div
              key={e.id}
              className="rounded-xl border border-white/10 bg-white/5 px-6 py-5 transition hover:bg-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{e.courseName}</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Đăng ký:{" "}
                    {e.enrolledAt
                      ? new Date(e.enrolledAt).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "-"}
                  </p>
                  {e.daysUntilCourseEnd != null && (
                    <p className="mt-1 text-xs text-amber-500/90">Còn {e.daysUntilCourseEnd} ngày kết thúc khóa học</p>
                  )}
                  {e.totalLessons > 0 && (
                    <div className="mt-3">
                      <ProgressBar
                        completed={e.completedCount}
                        total={e.totalLessons}
                        label="Tiến độ"
                        className="max-w-md"
                      />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/learn/${e.id}`}
                    className="rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#E7C768]"
                  >
                    Vào học
                  </Link>
                  {e.salePriceCents > 0 && !e.needsPayment && (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                      Đã thanh toán
                    </span>
                  )}
                  {e.salePriceCents <= 0 && (
                    <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-400">
                      Miễn phí
                    </span>
                  )}
                  {e.needsPayment && (
                    <Link
                      href={`/checkout?courseId=${e.courseId}`}
                      className="rounded-full border border-amber-500/50 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/20"
                    >
                      Thanh toán để học tiếp
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-gray-400">
            Bạn chưa đăng ký khóa học nào. Hãy khám phá và đăng ký khóa học phù hợp với bạn.
          </p>
          <Link
            href="/courses"
            className="mt-4 inline-block rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#E7C768]"
          >
            Khám phá khóa học
          </Link>
        </div>
      )}

      {list.length > 0 && (
        <Link
          href="/courses"
          className="mt-8 inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
        >
          Khám phá thêm khóa học
        </Link>
      )}

      <SelfTempLockSection hasPaidBefore={hasPaidBefore} />

      {lessonQuestions.length > 0 && (
        <section className="mt-14">
          <h2 className="font-[family-name:var(--font-serif)] text-xl font-bold text-[#D4AF37]">
            Hỏi đáp bài học
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Câu hỏi của bạn và phản hồi từ giảng viên. Mở bài học để xem chi tiết hội thoại.
          </p>
          <div className="mt-6 space-y-4">
            {lessonQuestions.map((q) => {
              const href = q.enrollmentId
                ? `/learn/preview/${q.lesson_id}?enrollmentId=${encodeURIComponent(q.enrollmentId)}`
                : `/learn/preview/${q.lesson_id}`;
              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/10"
                >
                  <p className="text-xs text-gray-500">
                    {q.programName} · {q.baseCourseName} · {q.lessonName}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-200">{q.content}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {new Date(q.created_at).toLocaleDateString("vi-VN")}
                    </span>
                    {q.hasReplies ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
                        Đã có trả lời
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
                        Chờ trả lời
                      </span>
                    )}
                    <Link
                      href={href}
                      className="text-sm font-medium text-[#D4AF37] hover:underline"
                    >
                      Vào bài học
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
