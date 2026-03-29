import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../lib/supabase-admin";
import { getCourseDisplayStatus } from "../../../lib/course-status";
import { daysUntil } from "../../../lib/course-lifecycle";
import { formatPriceDisplay } from "../../../lib/course-price";
import {
  isRoleBlockedFromSelfServiceEnrollment,
  SELF_SERVICE_ENROLLMENT_FORBIDDEN,
} from "../../../lib/self-service-enrollment";
import NavLogoWithBanner from "../../../components/NavLogoWithBanner";
import CourseDetailModal from "./CourseDetailModal";
import EnrollButton from "../../../components/EnrollButton";
import CancelEnrollmentButton from "../../../components/CancelEnrollmentButton";

export const dynamic = "force-dynamic";

type CourseDetailProps = {
  params: Promise<{ id: string }>;
};

export default async function CourseDetailPage({ params }: CourseDetailProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const admin = getSupabaseAdminClient();

  const { data: course, error } = await admin
    .from("regular_courses")
    .select(`
      id,
      name,
      price_cents,
      discount_percent,
      registration_open_at,
      registration_close_at,
      course_start_at,
      course_end_at,
      base_course:base_courses(id, name, code, summary, objectives, program_id)
    `)
    .eq("id", id)
    .single();

  if (error || !course) notFound();

  const now = new Date();
  const isVisible =
    (course.registration_close_at == null || new Date(course.registration_close_at) >= now) &&
    (course.course_end_at == null || new Date(course.course_end_at) >= now);
  if (!isVisible) notFound();

  const base = course.base_course as {
    id?: string;
    name?: string;
    summary?: string;
    objectives?: string;
    program_id?: string;
  } | null;
  const baseCourseId = base?.id;
  const programId = base?.program_id;

  let passPercent: number | null = null;
  if (baseCourseId) {
    const { data: bc } = await admin
      .from("base_courses")
      .select("certificate_pass_percent")
      .eq("id", baseCourseId)
      .single();
    if (!bc || bc.certificate_pass_percent == null) {
      passPercent = null;
    } else {
      passPercent = Number(bc.certificate_pass_percent);
    }
  }

  let publicChapters: { name: string; sort_order: number }[] = [];
  if (baseCourseId) {
    const { data: ch } = await admin
      .from("chapters")
      .select("name, sort_order")
      .eq("base_course_id", baseCourseId)
      .order("sort_order", { ascending: true });
    publicChapters = ch ?? [];
  }

  const { data: { user } } = await supabase.auth.getUser();
  let userRole: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    userRole = (profile as { role?: string } | null)?.role;
  }

  let isAdminOrOwnerView = false;
  let userEnrollmentId: string | null = null;
  let enrollmentHasCertificate = false;
  let detailChapters: { id: string; name: string; sortOrder: number; lessons: { id: string; name: string; sortOrder: number }[] }[] = [];
  let enrolledCount = 0;
  let paidCount = 0;

  if (user && programId) {
    if (userRole === "owner") {
      isAdminOrOwnerView = true;
    } else if (userRole === "admin") {
      const { data: aep } = await admin
        .from("admin_editable_programs")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("program_id", programId)
        .limit(1);
      if (aep?.length) isAdminOrOwnerView = true;
    }

    if (user && !isAdminOrOwnerView) {
      const { data: myEnroll } = await admin
        .from("enrollments")
        .select("id")
        .eq("user_id", user.id)
        .eq("regular_course_id", id)
        .eq("status", "active")
        .maybeSingle();
      userEnrollmentId = myEnroll?.id ?? null;
    }

    if (userEnrollmentId) {
      const { data: certRow } = await admin
        .from("certificates")
        .select("id")
        .eq("enrollment_id", userEnrollmentId)
        .maybeSingle();
      enrollmentHasCertificate = Boolean(certRow);
    }

    if (isAdminOrOwnerView && baseCourseId) {
      const { data: chapters } = await admin
        .from("chapters")
        .select("id, name, sort_order")
        .eq("base_course_id", baseCourseId)
        .order("sort_order", { ascending: true });
      const chapterIds = (chapters ?? []).map((c) => c.id);
      const { data: lessons } = chapterIds.length
        ? await admin
            .from("lessons")
            .select("id, chapter_id, name, sort_order")
            .in("chapter_id", chapterIds)
            .order("sort_order", { ascending: true })
        : { data: [] as { id: string; chapter_id: string; name: string; sort_order: number }[] };
      const lessonsByChapter = (lessons ?? []).reduce(
        (acc, l) => {
          if (!acc[l.chapter_id]) acc[l.chapter_id] = [];
          acc[l.chapter_id].push({
            id: l.id,
            name: l.name,
            sortOrder: l.sort_order,
          });
          return acc;
        },
        {} as Record<string, { id: string; name: string; sortOrder: number }[]>
      );
      detailChapters = (chapters ?? []).map((ch) => ({
        id: ch.id,
        name: ch.name,
        sortOrder: ch.sort_order,
        lessons: (lessonsByChapter[ch.id] ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      }));

      const { count: enrollCount } = await admin
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("regular_course_id", id)
        .eq("status", "active");
      enrolledCount = enrollCount ?? 0;

      const { data: enrolls } = await admin
        .from("enrollments")
        .select("payment_id")
        .eq("regular_course_id", id)
        .eq("status", "active");
      const payIds = (enrolls ?? []).map((e) => e.payment_id).filter(Boolean) as string[];
      if (payIds.length > 0) {
        const { data: completed } = await admin
          .from("payments")
          .select("id")
          .in("id", payIds)
          .eq("status", "completed");
        paidCount = completed?.length ?? 0;
      }
    }
  }

  const price = Number(course.price_cents) || 0;
  const discount = (course as { discount_percent?: number | null }).discount_percent ?? null;
  const priceInfo = formatPriceDisplay(price, discount);
  const status = getCourseDisplayStatus(
    course.registration_open_at,
    course.registration_close_at,
    course.course_end_at
  );
  const roleBlockedSelfService = isRoleBlockedFromSelfServiceEnrollment(userRole);
  const canEnroll =
    status === "đang mở đăng ký" &&
    !isAdminOrOwnerView &&
    !userEnrollmentId &&
    !roleBlockedSelfService;

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <nav className="border-b border-white/8 bg-[#0a1628]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[var(--container-max)] items-center justify-between px-4 py-3 sm:px-6">
          <NavLogoWithBanner />
          <div className="flex gap-3">
            <Link
              href="/courses"
              className="text-sm text-gray-400 hover:text-white"
            >
              Khóa học
            </Link>
            {user ? (
              <Link
                href={isAdminOrOwnerView ? "/admin" : "/student"}
                className="rounded-full border border-[#D4AF37]/50 px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="rounded-full border border-[#D4AF37]/50 px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                Đăng nhập
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <Link href="/courses" className="text-sm text-[#D4AF37] hover:underline">
          ← Khóa học
        </Link>

        <h1 className="mt-6 font-[family-name:var(--font-serif)] text-3xl font-bold text-[#D4AF37]">
          {course.name}
        </h1>
        <span
          className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${
            status === "sắp mở"
              ? "bg-amber-500/20 text-amber-300"
              : status === "đang mở đăng ký"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-gray-500/20 text-gray-400"
          }`}
        >
          {status}
        </span>

        {base?.summary && (
          <p className="mt-4 text-gray-300">{base.summary}</p>
        )}

        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="mb-2 font-semibold uppercase tracking-wide text-[#D4AF37]">Thời gian đăng ký</p>
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Mở đăng ký</dt>
                <dd>{course.registration_open_at ? new Date(course.registration_open_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Đóng đăng ký</dt>
                <dd>{course.registration_close_at ? new Date(course.registration_close_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="mb-2 font-semibold uppercase tracking-wide text-[#D4AF37]">Thời gian học</p>
            <dl className="space-y-1.5">
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Bắt đầu khóa</dt>
                <dd>{course.course_start_at ? new Date(course.course_start_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-gray-500">Kết thúc khóa</dt>
                <dd>{course.course_end_at ? new Date(course.course_end_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</dd>
              </div>
            </dl>
          </div>
        </div>

        {(() => {
          const regDeadline = course.registration_close_at ?? course.course_end_at;
          const daysUntilRegClose = daysUntil(regDeadline);
          const daysUntilCourseEnd = daysUntil(course.course_end_at);
          if (daysUntilRegClose == null && daysUntilCourseEnd == null) return null;
          return (
            <div className="mt-4 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/5 px-4 py-3">
              <div className="flex flex-wrap gap-4 text-sm">
                {daysUntilRegClose != null && !userEnrollmentId && (
                  <span className="font-medium text-amber-400">Còn {daysUntilRegClose} ngày để đăng ký</span>
                )}
                {daysUntilCourseEnd != null && (
                  <span className="font-medium text-gray-300">Còn {daysUntilCourseEnd} ngày kết thúc khóa học</span>
                )}
              </div>
            </div>
          );
        })()}

        <div className="mt-8 flex flex-wrap items-center gap-6">
          {priceInfo.hasDiscount ? (
            <div className="text-2xl font-bold">
              <span className="line-through text-gray-500">{priceInfo.originalDisplay}</span>
              <span className="ml-2 text-[#D4AF37]">{priceInfo.saleDisplay}</span>
              <span className="ml-2 rounded-full bg-red-500/20 px-3 py-1 text-sm font-semibold text-red-300">
                -{discount}%
              </span>
            </div>
          ) : (
            <p className="text-2xl font-bold text-[#D4AF37]">{priceInfo.display}</p>
          )}
          {isAdminOrOwnerView ? (
            <CourseDetailModal
              courseName={course.name}
              chapters={detailChapters}
              enrolledCount={enrolledCount}
              paidCount={paidCount}
            />
          ) : canEnroll ? (
            <EnrollButton
              courseId={course.id}
              className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
            >
              Đăng ký ngay
            </EnrollButton>
          ) : roleBlockedSelfService &&
            status === "đang mở đăng ký" &&
            !userEnrollmentId &&
            !isAdminOrOwnerView ? (
            <p className="max-w-xl text-sm text-amber-200/90">{SELF_SERVICE_ENROLLMENT_FORBIDDEN}</p>
          ) : userEnrollmentId ? (
            <div className="flex w-full max-w-3xl flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={`/learn/${userEnrollmentId}`}
                className="inline-flex shrink-0 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-6 py-2.5 text-sm font-bold text-emerald-300 hover:bg-emerald-500/20"
              >
                Đã đăng ký · Vào học
              </Link>
              {!enrollmentHasCertificate && (
                <CancelEnrollmentButton
                  enrollmentId={userEnrollmentId}
                  courseName={course.name}
                  variant="onDark"
                  className="shrink-0"
                />
              )}
            </div>
          ) : status === "sắp mở" ? (
            <span className="rounded-full border border-amber-500/50 px-6 py-2.5 text-sm font-medium text-amber-300">
              Sắp mở đăng ký
            </span>
          ) : null}
        </div>

        {!isAdminOrOwnerView && !user && (
          <p className="mt-4 text-sm text-gray-500">
            Bạn cần đăng nhập để tiếp tục.
          </p>
        )}

        {base?.objectives && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-white">MỤC TIÊU CỦA KHÓA HỌC</h2>
            <div className="mt-3 whitespace-pre-wrap rounded-lg border border-white/10 bg-white/5 p-4 text-gray-300">
              {base.objectives}
            </div>
          </div>
        )}

        {publicChapters.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold text-[#D4AF37]">NHỮNG GÌ BẠN SẼ HỌC</h2>
            <ul className="mt-3 space-y-2">
              {publicChapters.map((ch, idx) => (
                <li key={idx} className="flex items-center gap-2 text-gray-300">
                  <span className="text-[#D4AF37]">Chương {idx + 1}:</span>
                  <span>{ch.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-10 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-4">
          <h2 className="text-lg font-semibold text-[#D4AF37]">ĐIỀU KIỆN NHẬN CHỨNG CHỈ</h2>
          <p className="mt-2 text-gray-300">
            Đạt từ {passPercent != null ? Math.round(passPercent) : ""}% tổng số điểm của khóa để nhận chứng chỉ hoàn thành.
          </p>
        </div>
      </main>
    </div>
  );
}
