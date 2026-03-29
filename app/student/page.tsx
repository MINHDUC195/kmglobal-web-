import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../lib/supabase-admin";
import { getSalePriceCents } from "../../lib/course-price";
import { getEffectiveDiscountPercent } from "../../lib/promotion-tiers";
import ProgressBar from "../../components/ProgressBar";
import SelfTempLockSection from "../../components/SelfTempLockSection";
import CancelEnrollmentButton from "../../components/CancelEnrollmentButton";
import { daysUntil } from "../../lib/course-lifecycle";
import { syncWhitelistEnrollmentsForUser } from "../../lib/whitelist-reconcile";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  try {
    await syncWhitelistEnrollmentsForUser(admin, user.id);
  } catch (e) {
    console.error("syncWhitelistEnrollmentsForUser:", e);
  }
  const { data: enrollments } = await admin
    .from("enrollments")
    .select(
      `
      id,
      enrolled_at,
      payment_id,
      regular_course_id,
      regular_courses(id, name, price_cents, discount_percent, promotion_tiers, active_enrollment_count, registration_close_at, course_end_at, base_course:base_courses(id))
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
  const enrollmentRows = enrollments ?? [];
  const baseCourseIds = [
    ...new Set(
      enrollmentRows
        .map((e) => (e.regular_courses as { base_course?: { id?: string } } | null)?.base_course?.id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const enrollmentIds = enrollmentRows.map((e) => e.id);
  const paymentIds = [
    ...new Set(
      enrollmentRows
        .map((e) => e.payment_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: chapterRows }, { data: progressRows }, { data: paymentRows }] = await Promise.all([
    baseCourseIds.length
      ? admin.from("chapters").select("id, base_course_id").in("base_course_id", baseCourseIds)
      : Promise.resolve({ data: [] as { id: string; base_course_id: string }[] }),
    enrollmentIds.length
      ? admin.from("lesson_progress").select("enrollment_id").in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [] as { enrollment_id: string }[] }),
    paymentIds.length
      ? admin.from("payments").select("id, status").in("id", paymentIds)
      : Promise.resolve({ data: [] as { id: string; status: string }[] }),
  ]);

  const chapterList = chapterRows ?? [];
  const chapterIds = chapterList.map((c) => c.id);
  const { data: lessonRows } = chapterIds.length
    ? await admin.from("lessons").select("chapter_id").in("chapter_id", chapterIds)
    : { data: [] as { chapter_id: string }[] };

  const chapterToBase = new Map(chapterList.map((c) => [c.id, c.base_course_id]));
  const totalLessonsByBase = new Map<string, number>();
  for (const lesson of lessonRows ?? []) {
    const baseId = chapterToBase.get(lesson.chapter_id);
    if (!baseId) continue;
    totalLessonsByBase.set(baseId, (totalLessonsByBase.get(baseId) ?? 0) + 1);
  }

  const completedByEnrollment = new Map<string, number>();
  for (const row of progressRows ?? []) {
    completedByEnrollment.set(
      row.enrollment_id,
      (completedByEnrollment.get(row.enrollment_id) ?? 0) + 1
    );
  }

  const paymentStatusById = new Map((paymentRows ?? []).map((p) => [p.id, p.status]));

  for (const e of enrollmentRows) {
    const rc = e.regular_courses as {
      name?: string | null;
      price_cents?: number | null;
      discount_percent?: number | null;
      promotion_tiers?: unknown;
      active_enrollment_count?: number | null;
      registration_close_at?: string | null;
      course_end_at?: string | null;
      base_course?: { id?: string } | null;
    } | null;
    const baseCourseId = rc?.base_course?.id ?? null;
    const totalLessons = baseCourseId ? totalLessonsByBase.get(baseCourseId) ?? 0 : 0;
    const completedCount = completedByEnrollment.get(e.id) ?? 0;

    const priceCents = Number(rc?.price_cents) || 0;
    const n = Math.max(0, Math.floor(Number(rc?.active_enrollment_count) || 0));
    const discountPercent = getEffectiveDiscountPercent(
      rc?.promotion_tiers,
      rc?.discount_percent,
      n
    );
    const salePriceCents = getSalePriceCents(priceCents, discountPercent);
    const isFreeCourse = salePriceCents <= 0;
    const isPaid =
      isFreeCourse || (e.payment_id ? paymentStatusById.get(e.payment_id) === "completed" : false);
    const needsPayment = !isFreeCourse && !isPaid;

    list.push({
      id: e.id,
      courseName: rc?.name ?? "Khóa học",
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
              className="rounded-2xl border border-[#1E365A] bg-gradient-to-br from-[#0d203a] to-[#0a1b33] px-5 py-5 shadow-[0_10px_24px_rgba(0,0,0,0.25)] transition hover:border-[#2A4D77] sm:px-6"
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-white sm:text-lg">{e.courseName}</p>
                    {e.needsPayment && e.salePriceCents > 0 && (
                      <Link
                        href={`/checkout?courseId=${e.courseId}`}
                        className="inline-flex items-center justify-center rounded-full border border-amber-400/50 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-400/20"
                      >
                        Nâng cấp
                      </Link>
                    )}
                  </div>
                  {e.salePriceCents > 0 && e.needsPayment && (
                    <p className="mt-1 text-xs font-semibold text-amber-300">
                      Bạn Đang ở chế độ học thử
                    </p>
                  )}
                  <p className="mt-1 text-sm text-[#9FB3C8]">
                    Đăng ký:{" "}
                    {e.enrolledAt
                      ? new Date(e.enrolledAt).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })
                      : "-"}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {e.daysUntilCourseEnd != null && (
                      <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                        Còn {e.daysUntilCourseEnd} ngày kết thúc
                      </span>
                    )}
                    {e.salePriceCents > 0 && !e.needsPayment && (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                        Đã thanh toán
                      </span>
                    )}
                    {e.salePriceCents <= 0 && (
                      <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-gray-300">
                        Miễn phí
                      </span>
                    )}
                  </div>
                  {e.totalLessons > 0 && (
                    <div className="mt-4 rounded-xl border border-[#2A4D77] bg-[#0A1A30] px-4 py-3">
                      <ProgressBar
                        completed={e.completedCount}
                        total={e.totalLessons}
                        label="Tiến độ"
                        className="max-w-xl"
                      />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2 lg:min-w-[220px]">
                  <Link
                    href={`/learn/${e.id}`}
                    className="inline-flex items-center justify-center rounded-full bg-[#6FCF97] px-5 py-2.5 text-sm font-semibold text-[#063A1E] hover:bg-[#7FDCAB]"
                  >
                    Vào học
                  </Link>
                  <CancelEnrollmentButton enrollmentId={e.id} courseName={e.courseName} variant="onDark" />
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
    </>
  );
}
