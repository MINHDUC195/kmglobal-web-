import Link from "next/link";
import { getSupabaseAdminClient } from "../../lib/supabase-admin";
import { getCachedRegularCoursesCatalog } from "../../lib/cached-catalog";
import { createServerSupabaseClient } from "../../lib/supabase-server";
import NavLogoWithBanner from "../../components/NavLogoWithBanner";
import Footer from "../../components/Footer";
import CoursesCatalogClient from "../../components/CoursesCatalogClient";
import { getBaseCourseIdsToHideForUser } from "../../lib/hide-improved-courses-for-old-students";

export const metadata = {
  title: "Khóa học | KM Global Academy",
  description: "Chương trình đào tạo ISO 9001, IATF 16949, ISO 14001, ISO 45001",
};

export default async function CoursesPage() {
  const allCourses = await getCachedRegularCoursesCatalog();

  const admin = getSupabaseAdminClient();
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  let dashboardHref: "/student" | "/admin" | "/owner" = "/student";
  let displayName = "Học viên";
  const enrolledByCourse = new Map<string, string>();
  if (user) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role?: string; full_name?: string | null } | null)?.role;
    if (role === "owner") dashboardHref = "/owner";
    else if (role === "admin") dashboardHref = "/admin";
    const fullName = (profile as { full_name?: string | null } | null)?.full_name?.trim();
    if (fullName) displayName = fullName;

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

  const enrolledByCourseObject = Object.fromEntries(enrolledByCourse.entries());

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <nav className="border-b border-white/8 bg-[#0a1628]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[var(--container-max)] items-center justify-between px-4 py-3 sm:px-6">
          <NavLogoWithBanner />
          <div className="flex items-center gap-3">
            {user && (
              <>
                <Link
                  href={dashboardHref}
                  className="text-sm font-medium text-[#D4AF37] hover:underline"
                >
                  Dashboard
                </Link>
                <span className="text-sm text-gray-400">Xin chào, {displayName}</span>
              </>
            )}
            <Link
              href="/"
              className="rounded-full border border-[#D4AF37]/50 px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              Trang chủ
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-bold uppercase text-[#D4AF37]">
          Khóa học
        </h1>
        <p className="mt-2 text-gray-400">
          Chọn khóa học phù hợp và đăng ký để bắt đầu học.
        </p>

        <CoursesCatalogClient
          courses={courses as Parameters<typeof CoursesCatalogClient>[0]["courses"]}
          enrolledByCourse={enrolledByCourseObject}
        />
      </main>

      <Footer hideLogo />
    </div>
  );
}
