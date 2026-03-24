import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getCachedRegularCoursesCatalog } from "../../../../lib/cached-catalog";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import NavLogoWithBanner from "../../../../components/NavLogoWithBanner";
import Footer from "../../../../components/Footer";
import { getCourseDisplayStatus } from "../../../../lib/course-status";
import { daysUntil } from "../../../../lib/course-lifecycle";
import { formatPriceDisplay } from "../../../../lib/course-price";
import { stripRevSuffix } from "../../../../lib/course-display-name";
import { getBaseCourseIdsToHideForUser } from "../../../../lib/hide-improved-courses-for-old-students";

type ProgramCoursesPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ProgramCoursesPageProps) {
  const { id } = await params;
  const admin = getSupabaseAdminClient();
  const { data: program } = await admin
    .from("programs")
    .select("name, code")
    .eq("id", id)
    .single();
  const title = program ? `${program.name} | Khóa học | KM Global Academy` : "Khóa học | KM Global Academy";
  const desc = program
    ? `Khám phá khóa học thuộc chương trình ${program.name}`
    : "Khám phá khóa học theo chương trình đào tạo";
  return { title, description: desc };
}

export default async function ProgramCoursesPage({ params }: ProgramCoursesPageProps) {
  const { id } = await params;
  const admin = getSupabaseAdminClient();

  const { data: program, error: progErr } = await admin
    .from("programs")
    .select("id, name, code")
    .eq("id", id)
    .eq("approval_status", "approved")
    .single();

  if (progErr || !program) {
    notFound();
  }

  const catalog = await getCachedRegularCoursesCatalog();
  const allCourses = catalog.filter((c) => c.program_id === id);

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const enrolledByCourse = new Map<string, string>();
  if (user) {
    const { data: enrolls } = await admin
      .from("enrollments")
      .select("id, regular_course_id")
      .eq("user_id", user.id)
      .eq("status", "active");
    for (const e of enrolls ?? []) {
      if (e.regular_course_id) enrolledByCourse.set(e.regular_course_id, e.id);
    }
  }

  const baseCourseIdsToHide = await getBaseCourseIdsToHideForUser(admin, user?.id ?? null);

  const now = new Date();
  let courses = (allCourses ?? []).filter(
    (c) =>
      (c.registration_close_at == null || new Date(c.registration_close_at) >= now) &&
      (c.course_end_at == null || new Date(c.course_end_at) >= now)
  );
  courses = courses.filter((c) => {
    const base = c.base_course as { id?: string } | null;
    return !base?.id || !baseCourseIdsToHide.has(base.id);
  });

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <nav className="border-b border-white/8 bg-[#0a1628]/80 backdrop-blur-md">
        <div className="mx-auto max-w-[var(--container-max)] flex items-center justify-between px-4 py-3 sm:px-6">
          <NavLogoWithBanner />
          <div className="flex items-center gap-3">
            <Link
              href="/courses"
              className="rounded-full border border-[#D4AF37]/50 px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              Tất cả khóa học
            </Link>
            <Link
              href="/#programs-section"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-white/5"
            >
              Trang chủ
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <Link
          href="/#programs-section"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#D4AF37]"
        >
          ← Về trang chủ
        </Link>

        <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 px-6 py-4">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold uppercase text-white sm:text-3xl">
            {program.name}
          </h1>
        </div>

        {courses.length > 0 ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const base = c.base_course as { name?: string; code?: string; summary?: string } | null;
              const price = Number(c.price_cents) || 0;
              const discount = (c as { discount_percent?: number | null }).discount_percent ?? null;
              const priceInfo = formatPriceDisplay(price, discount);
              const status = getCourseDisplayStatus(
                c.registration_open_at,
                c.registration_close_at,
                c.course_end_at
              );
              const statusClass =
                status === "sắp mở"
                  ? "bg-amber-500/20 text-amber-300"
                  : status === "đang mở đăng ký"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-gray-500/20 text-gray-400";
              const isEnrolled = enrolledByCourse.has(c.id);
              const daysUntilRegClose = daysUntil(c.registration_close_at);
              const daysUntilCourseEnd = daysUntil(c.course_end_at);
              return (
                <div
                  key={c.id}
                  className="block rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-[#D4AF37]/40 hover:bg-white/10"
                >
                  <Link href={`/courses/${c.id}`} className="block">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="font-semibold text-white">{stripRevSuffix(c.name) || c.name}</h2>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {isEnrolled ? (
                          <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                            Đã đăng ký
                          </span>
                        ) : (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
                          >
                            {status}
                          </span>
                        )}
                      </div>
                    </div>
                  {base?.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-300">{base.summary}</p>
                  )}
                  <div className="mt-3 space-y-2 text-xs text-gray-500">
                    <div>
                      <p className="mb-0.5 font-medium text-gray-400">Đăng ký</p>
                      <dl className="space-y-0.5">
                        <div className="flex justify-between gap-2">
                          <dt>Mở:</dt>
                          <dd>
                            {c.registration_open_at
                              ? new Date(c.registration_open_at).toLocaleDateString("vi-VN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Đóng:</dt>
                          <dd>
                            {c.registration_close_at
                              ? new Date(c.registration_close_at).toLocaleDateString("vi-VN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <p className="mb-0.5 font-medium text-gray-400">Thời gian học</p>
                      <dl className="space-y-0.5">
                        <div className="flex justify-between gap-2">
                          <dt>Bắt đầu:</dt>
                          <dd>
                            {c.course_start_at
                              ? new Date(c.course_start_at).toLocaleDateString("vi-VN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Kết thúc:</dt>
                          <dd>
                            {c.course_end_at
                              ? new Date(c.course_end_at).toLocaleDateString("vi-VN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  {(daysUntilRegClose != null && !isEnrolled) || daysUntilCourseEnd != null ? (
                    <div className="mt-3 space-y-1 text-xs">
                      {daysUntilRegClose != null && !isEnrolled && (
                        <p className="text-amber-400">Còn {daysUntilRegClose} ngày để đăng ký</p>
                      )}
                      {daysUntilCourseEnd != null && (
                        <p className="text-gray-400">Còn {daysUntilCourseEnd} ngày kết thúc khóa học</p>
                      )}
                    </div>
                  ) : null}
                  <div className="mt-4">
                    {priceInfo.hasDiscount ? (
                      <p className="font-bold text-[#D4AF37]">
                        <span className="line-through text-gray-500">{priceInfo.originalDisplay}</span>
                        <span className="ml-2">{priceInfo.saleDisplay}</span>
                        <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
                          -{discount}%
                        </span>
                      </p>
                    ) : (
                      <p className="font-bold text-[#D4AF37]">{priceInfo.display}</p>
                    )}
                  </div>
                  </Link>
                  {isEnrolled ? (
                    <Link
                      href={`/learn/${enrolledByCourse.get(c.id)!}`}
                      className="mt-3 inline-block rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black hover:bg-[#E7C768]"
                    >
                      Vào học
                    </Link>
                  ) : (
                    <Link
                      href={`/courses/${c.id}`}
                      className="mt-2 inline-block text-sm text-[#D4AF37] hover:underline"
                    >
                      Xem chi tiết →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-12 text-center">
            <p className="text-gray-400">Chưa có khóa học nào đang mở đăng ký trong chương trình này.</p>
            <p className="mt-2 text-sm text-gray-500">Vui lòng quay lại sau hoặc xem các chương trình khác.</p>
            <Link
              href="/courses"
              className="mt-6 inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] transition-all hover:bg-[#D4AF37]/10"
            >
              Xem tất cả khóa học
            </Link>
          </div>
        )}

        {courses.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/courses"
              className="inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] transition-all hover:bg-[#D4AF37]/10"
            >
              Xem tất cả khóa học
            </Link>
          </div>
        )}
      </main>

      <Footer hideLogo />
    </div>
  );
}
