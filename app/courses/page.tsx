import Link from "next/link";
import { getSupabaseAdminClient } from "../../lib/supabase-admin";
import { getCachedRegularCoursesCatalog } from "../../lib/cached-catalog";
import { createServerSupabaseClient } from "../../lib/supabase-server";
import NavLogoWithBanner from "../../components/NavLogoWithBanner";
import Footer from "../../components/Footer";
import { getCourseDisplayStatus } from "../../lib/course-status";
import { daysUntil } from "../../lib/course-lifecycle";
import { formatPriceDisplay } from "../../lib/course-price";

export const metadata = {
  title: "Khóa học | KM Global Academy",
  description: "Chương trình đào tạo ISO 9001, IATF 16949, ISO 14001, ISO 45001",
};

export default async function CoursesPage() {
  const allCourses = await getCachedRegularCoursesCatalog();

  const admin = getSupabaseAdminClient();
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

  const now = new Date();
  const courses = (allCourses ?? []).filter(
    (c) =>
      (c.registration_close_at == null || new Date(c.registration_close_at) >= now) &&
      (c.course_end_at == null || new Date(c.course_end_at) >= now)
  );

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <nav className="border-b border-white/8 bg-[#0a1628]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[var(--container-max)] items-center justify-between px-4 py-3 sm:px-6">
          <NavLogoWithBanner />
          <Link
            href="/"
            className="rounded-full border border-[#D4AF37]/50 px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            Trang chủ
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-bold uppercase text-[#D4AF37]">
          Khóa học
        </h1>
        <p className="mt-2 text-gray-400">
          Chọn khóa học phù hợp và đăng ký để bắt đầu học.
        </p>

        {courses?.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => {
              const base = c.base_course as { name?: string; code?: string; summary?: string } | null;
              const program = c.program as { name?: string } | null;
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
                      <h2 className="font-semibold text-white">{c.name}</h2>
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
                    {program?.name && (
                      <p className="mt-1 text-sm text-gray-400">{program.name}</p>
                    )}
                    {base?.summary && (
                      <p className="mt-2 line-clamp-2 text-sm text-gray-300">{base.summary}</p>
                    )}
                    <div className="mt-3 space-y-2 text-xs text-gray-500">
                      <div>
                        <p className="mb-0.5 font-medium text-gray-400">Đăng ký</p>
                        <dl className="space-y-0.5">
                          <div className="flex justify-between gap-2">
                            <dt>Mở:</dt>
                            <dd>{c.registration_open_at ? new Date(c.registration_open_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>Đóng:</dt>
                            <dd>{c.registration_close_at ? new Date(c.registration_close_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</dd>
                          </div>
                        </dl>
                      </div>
                      <div>
                        <p className="mb-0.5 font-medium text-gray-400">Thời gian học</p>
                        <dl className="space-y-0.5">
                          <div className="flex justify-between gap-2">
                            <dt>Bắt đầu:</dt>
                            <dd>{c.course_start_at ? new Date(c.course_start_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</dd>
                          </div>
                          <div className="flex justify-between gap-2">
                            <dt>Kết thúc:</dt>
                            <dd>{c.course_end_at ? new Date(c.course_end_at).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</dd>
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
            <p className="text-gray-400">Chưa có khóa học nào đang mở đăng ký.</p>
            <p className="mt-2 text-sm text-gray-500">Vui lòng quay lại sau.</p>
            <Link href="/" className="mt-6 inline-block text-[#D4AF37] hover:underline">
              ← Về trang chủ
            </Link>
          </div>
        )}
      </main>

      <Footer hideLogo />
    </div>
  );
}
