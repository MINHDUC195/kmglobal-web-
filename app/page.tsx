import Link from "next/link";
import Footer from "../components/Footer";
import HeaderAuthControls from "../components/HeaderAuthControls";
import LandingFinalCtaLink from "../components/LandingFinalCtaLink";
import NavLogoWithBanner from "../components/NavLogoWithBanner";
import SectionHeader from "../components/SectionHeader";
import { getSupabaseAdminClient } from "../lib/supabase-admin";
import { getCachedApprovedPrograms, getCachedRegularCoursesCatalog } from "../lib/cached-catalog";
import { createServerSupabaseClient } from "../lib/supabase-server";
import { getCourseDisplayStatus } from "../lib/course-status";
import { daysUntil } from "../lib/course-lifecycle";
import { formatPriceDisplay } from "../lib/course-price";
import { stripRevSuffix } from "../lib/course-display-name";
import { getBaseCourseIdsToHideForUser } from "../lib/hide-improved-courses-for-old-students";

export const dynamic = "force-dynamic";

type LandingPageProps = {
  searchParams: Promise<{ toast?: string }>;
};

const FEATURES = [
  { title: "Nội dung chuyên sâu", desc: "Khóa học được xây dựng dựa trên tiêu chuẩn quốc tế mới nhất, cập nhật liên tục từ ISO.org và IATF Global Oversight" },
  { title: "Video bài giảng", desc: "Nội dung video chuyên sâu, dễ hiểu, học mọi lúc mọi nơi trên mọi thiết bị" },
  { title: "Chứng chỉ có giá trị", desc: "Nhận chứng chỉ điện tử với mã QR xác thực duy nhất, được lưu trữ an toàn trong tài khoản của bạn" },
  { title: "Học linh hoạt", desc: "Tự sắp xếp thời gian học phù hợp. Khóa học theo tháng với lịch đăng ký rõ ràng" },
  { title: "Thanh toán dễ dàng", desc: "Hỗ trợ thanh toán qua QR code ngân hàng và thẻ tín dụng. Mở khóa ngay sau khi thanh toán thành công" },
  { title: "Bảo mật & tin cậy", desc: "Chống sao chép nội dung, bảo vệ tài sản trí tuệ của người dạy và học viên" },
];

const STEPS = [
  { num: "01", title: "Đăng ký", desc: "Tạo tài khoản và chọn khóa học phù hợp với nhu cầu của bạn." },
  { num: "02", title: "Thanh toán", desc: "Mở khóa toàn bộ khóa học qua QR code ngân hàng hoặc thẻ tín dụng." },
  { num: "03", title: "Học và luyện tập", desc: "Học video, làm bài kiểm tra và bài tập theo từng chủ đề của khóa học." },
  { num: "04", title: "Nhận chứng chỉ", desc: "Hoàn thành khóa học với điểm ≥ 70% và nhận chứng chỉ điện tử có mã QR xác thực." },
];

const ABOUT_ITEMS = [
  { title: "CẬP NHẬT LIÊN TỤC", desc: "Theo tiêu chuẩn mới nhất" },
  { title: "HỌC LINH HOẠT", desc: "Mọi lúc, mọi nơi" },
  { title: "BẢO MẬT CAO", desc: "Hệ thống bảo mật nhiều lớp" },
  { title: "CHỨNG CHỈ GIÁ TRỊ", desc: "Được công nhận rộng rãi" },
];

export default async function LandingPage({ searchParams }: LandingPageProps) {
  const { toast } = await searchParams;

  const [programs, allCourses, supabase] = await Promise.all([
    getCachedApprovedPrograms(),
    getCachedRegularCoursesCatalog(),
    createServerSupabaseClient(),
  ]);

  const admin = getSupabaseAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let finalCtaHref: "/login" | "/student" | "/admin" | "/owner" = "/login";
  if (user?.id) {
    const { data: profileForCta } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profileForCta as { role?: string } | null)?.role;
    if (role === "owner") finalCtaHref = "/owner";
    else if (role === "admin") finalCtaHref = "/admin";
    else finalCtaHref = "/student";
  }

  // #region agent log
  fetch("http://127.0.0.1:7813/ingest/2622e3a9-df77-46ca-ab07-dad3169e247f", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "56767c" },
    body: JSON.stringify({
      sessionId: "56767c",
      location: "app/page.tsx:LandingPage",
      message: "final CTA server render",
      data: {
        hypothesisId: "H1",
        hasServerUser: Boolean(user?.id),
        serverFinalCtaHref: finalCtaHref,
      },
      timestamp: Date.now(),
      runId: "post-fix-verify",
    }),
  }).catch(() => {});
  // #endregion

  const enrolledByCourse = new Map<string, string>();
  let baseCourseIdsToHide = new Set<string>();

  if (user) {
    const [enrollRes, hideRes] = await Promise.all([
      admin
        .from("enrollments")
        .select("id, regular_course_id")
        .eq("user_id", user.id)
        .eq("status", "active"),
      getBaseCourseIdsToHideForUser(admin, user.id),
    ]);
    for (const e of enrollRes.data ?? []) {
      if (e.regular_course_id) enrolledByCourse.set(e.regular_course_id, e.id);
    }
    baseCourseIdsToHide = hideRes;
  }

  const now = new Date();
  let openCourses = (allCourses ?? []).filter(
    (c) =>
      (c.registration_close_at == null || new Date(c.registration_close_at) >= now) &&
      (c.course_end_at == null || new Date(c.course_end_at) >= now)
  );
  openCourses = openCourses.filter((c) => {
    const base = c.base_course as { id?: string } | null;
    return !base?.id || !baseCourseIdsToHide.has(base.id);
  });
  const displayCourses = openCourses.slice(0, 6);

  /** Map: programId -> baseCourseId -> first regular course (for direct link) */
  const programBaseToRegular = new Map<string, Map<string, (typeof openCourses)[0]>>();
  for (const rc of openCourses) {
    const prog = rc.program as { id?: string } | null;
    const base = rc.base_course as { id?: string } | null;
    if (!prog?.id || !base?.id) continue;
    let inner = programBaseToRegular.get(prog.id);
    if (!inner) {
      inner = new Map();
      programBaseToRegular.set(prog.id, inner);
    }
    if (!inner.has(base.id)) inner.set(base.id, rc);
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-[#0a1628]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgba(212,175,55,0.10),transparent),radial-gradient(ellipse_50%_35%_at_50%_100%,rgba(30,58,138,0.20),transparent)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+PHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik02MCAwTDAgNjAiIHN0cm9rZT0iI0Q0QUYzNyIgc3Ryb2tlLXdpZHRoPSIwLjMiLz48L3N2Zz4=')]" />

      {/* Nav */}
      <nav className="relative z-20 w-full border-b border-white/8 bg-[#0a1628]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[var(--container-max)] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <NavLogoWithBanner />
          <div className="flex min-w-0 flex-1 items-center justify-end sm:flex-none sm:justify-end">
            <HeaderAuthControls />
          </div>
        </div>
      </nav>

      {toast === "admin-denied" && (
        <div className="relative z-20 mx-auto mt-4 w-full max-w-[var(--container-max)] px-4 sm:px-6">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <span>Tài khoản của bạn chưa có quyền truy cập khu vực Quản trị.</span>
          </div>
        </div>
      )}

      <main>
      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-20 lg:py-24">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#D4AF37]/80">
          Nền tảng đào tạo tiêu chuẩn quốc tế
        </p>
        <h1 className="overflow-visible font-[family-name:var(--font-serif)] text-4xl font-bold uppercase leading-tight tracking-[0.05em] sm:text-5xl md:text-6xl lg:text-7xl">
          <span className="block text-white/95">Đào tạo chuyên sâu</span>
          <span className="mt-2 block overflow-visible px-3 py-2 leading-[1.5] font-[family-name:var(--font-serif)] font-bold uppercase [font-variant-numeric:lining-nums_tabular-nums] bg-[length:120%_100%] bg-[position:center] bg-gradient-to-r from-[#C9A227] via-[#f5e1a4] to-[#C9A227] bg-clip-text text-transparent">
            CÁC TIÊU CHUẨN
          </span>
        </h1>

        <p className="mt-5 max-w-3xl text-base leading-relaxed text-gray-300 sm:text-lg">
          KM GLOBAL ACADEMY — Nơi kiến thức chuyên sâu về các tiêu chuẩn quản lý quốc tế được truyền đạt bởi những chuyên gia hàng đầu. Chúng tôi không chỉ đào tạo — chúng tôi kiến tạo những nhà lãnh đạo chất lượng cho tương lai.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="#programs-section"
            className="rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-10 py-3.5 text-base font-bold text-black shadow-[0_0_18px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(212,175,55,0.55)] sm:text-lg"
          >
            Khám phá các chương trình học
          </Link>
          <Link
            href="/verify"
            className="rounded-full border-2 border-[#D4AF37]/70 bg-transparent px-10 py-3.5 text-base font-bold text-[#D4AF37] transition-all duration-300 hover:bg-[#D4AF37]/10 hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] sm:text-lg"
          >
            Xác minh chứng chỉ
          </Link>
        </div>
      </section>

      {/* About */}
      <section className="relative z-10 border-t border-white/10 bg-white/[0.02] px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[var(--container-max)]">
          <SectionHeader eyebrow="Về KM Global Academy" title="Kiến tạo chuyên gia chất lượng quốc tế" />

          <div className="mx-auto max-w-[var(--content-max)] space-y-4 text-center">
            <p className="leading-relaxed text-gray-400">
              KM GLOBAL ACADEMY là nền tảng đào tạo trực tuyến chuyên biệt về các tiêu chuẩn quản lý quốc tế, được vận hành bởi Công Ty TNHH KM GLOBAL — đơn vị tiên phong trong lĩnh vực tư vấn và đào tạo hệ thống quản lý chất lượng tại Việt Nam.
            </p>
            <p className="leading-relaxed text-gray-400">
            Chúng tôi tin rằng việc nắm vững các tiêu chuẩn ISO và IATF không chỉ là yêu cầu pháp lý — đó là nền tảng để doanh nghiệp bạn vươn tầm quốc tế, nâng cao năng suất, bảo vệ môi trường và đảm bảo an toàn cho người lao động.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:mt-16 lg:grid-cols-4">
            {ABOUT_ITEMS.map((item) => (
              <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
                <p className="font-semibold uppercase text-[#D4AF37]">{item.title}</p>
                <p className="mt-1 text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Course categories */}
      <section id="programs-section" className="relative z-10 border-t border-white/10 bg-white/[0.02] px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[var(--container-max)]">
          <SectionHeader
            eyebrow="Danh mục khóa học"
            title="Các chương trình đào tạo"
            subtitle="Chương trình đào tạo toàn diện bao gồm các tiêu chuẩn ISO/IATF thiết yếu cho mọi doanh nghiệp hiện đại"
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-8">
            {(programs ?? []).length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-white/20 bg-white/5 py-12 text-center">
                <p className="text-gray-400">Chưa có chương trình nào được phê duyệt</p>
                <p className="mt-2 text-sm text-gray-500">Vui lòng quay lại sau</p>
              </div>
            ) : (
            (programs ?? []).map((p) => {
              const baseCourses = (p.base_courses ?? []) as { id: string; name: string }[];
              const baseToRegular = programBaseToRegular.get(p.id);
              return (
                <div
                  key={p.id}
                  className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:border-[#D4AF37]/40 hover:shadow-[0_0_40px_rgba(212,175,55,0.15)] sm:p-8"
                >
                  <span className="inline-flex w-fit items-center rounded-full border border-[#D4AF37]/50 bg-[#D4AF37]/10 px-4 py-1.5 font-mono text-sm font-bold tracking-wide text-[#D4AF37] shadow-[0_0_18px_rgba(212,175,55,0.12)]">
                    {stripRevSuffix(p.name) || p.name}
                  </span>
                  {p.note && (
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-400">{p.note}</p>
                  )}
                  {baseCourses.filter((b) => !baseCourseIdsToHide.has(b.id)).length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        CÁC KHÓA HỌC
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {baseCourses
                          .filter((b) => !baseCourseIdsToHide.has(b.id))
                          .map((b) => {
                          const rc = baseToRegular?.get(b.id);
                          const content = (
                            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-300 transition hover:bg-[#D4AF37]/20 hover:text-[#D4AF37]">
                              {stripRevSuffix(b.name) || b.name}
                            </span>
                          );
                          return rc ? (
                            <Link
                              key={b.id}
                              href={`/courses/${rc.id}`}
                              className="inline-block"
                            >
                              {content}
                            </Link>
                          ) : (
                            <span key={b.id}>{content}</span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <Link
                    href={`/programs/${p.id}/courses`}
                    className="mt-5 inline-block w-fit rounded-full border border-[#D4AF37]/60 px-5 py-2 text-xs font-bold uppercase tracking-widest text-[#D4AF37] transition-all duration-300 hover:bg-[#D4AF37] hover:text-black"
                  >
                    Xem chi tiết các khóa học
                  </Link>
                </div>
              );
            })
            )}
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section className="relative z-10 px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[var(--container-max)]">
          <SectionHeader eyebrow="Tại sao chọn chúng tôi" title={"Hệ thống đào tạo và đánh giá năng lực\nToàn diện và chuyên nghiệp"} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 p-6">
                <h3 className="font-semibold text-[#D4AF37]">{f.title.toUpperCase()}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Courses this month */}
      <section className="relative z-10 border-t border-white/10 bg-white/[0.02] px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[var(--container-max)]">
          <SectionHeader
            eyebrow="Đang mở đăng ký"
            title="Khóa học tháng này"
            subtitle="Đăng ký ngay để không bỏ lỡ cơ hội học tập"
          />

          {displayCourses.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {displayCourses.map((c) => {
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
                        <h3 className="font-semibold text-white">{stripRevSuffix(c.name) || c.name}</h3>
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
                      {(stripRevSuffix(program?.name) || program?.name) && (
                        <p className="mt-1 text-sm text-gray-400">{stripRevSuffix(program?.name) || program?.name}</p>
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
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 py-12 text-center sm:py-16">
              <p className="text-gray-400">Chưa có khóa học nào đang mở</p>
              <p className="mt-2 text-sm text-gray-500">Vui lòng quay lại sau hoặc đăng ký nhận thông báo</p>
              <Link
                href="/courses"
                className="mt-6 inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] transition-all hover:bg-[#D4AF37]/10"
              >
                Xem tất cả
              </Link>
            </div>
          )}
          {displayCourses.length > 0 && (
            <div className="mt-8 text-center">
              <Link
                href="/courses"
                className="inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] transition-all hover:bg-[#D4AF37]/10"
              >
                Xem tất cả
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Process */}
      <section className="relative z-10 px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[var(--container-max)]">
          <SectionHeader eyebrow="Quy trình học tập" title="4 bước đơn giản đến chứng chỉ quốc tế" />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {STEPS.map((s) => (
              <div key={s.num} className="relative rounded-xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="flex justify-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#D4AF37]/70">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="mt-3 font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[var(--content-max)] rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-[#D4AF37]/10 to-transparent p-8 text-center sm:p-12">
          <h2 className="font-[family-name:var(--font-serif)] text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
            Bạn đã sẵn sàng nâng cao năng lực chuyên môn?
          </h2>
          <p className="mt-4 text-gray-400">
            Hãy bắt đầu hành trình học tập ngay hôm nay.
          </p>
          <LandingFinalCtaLink
            serverHref={finalCtaHref}
            className="mt-8 inline-block rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-12 py-4 text-base font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(212,175,55,0.5)]"
          >
            Bắt đầu ngay
          </LandingFinalCtaLink>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
}
