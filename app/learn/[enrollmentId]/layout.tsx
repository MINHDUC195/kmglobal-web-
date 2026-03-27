import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { guardStudentAccountOrRedirect } from "../../../lib/student-account-guard";
import { daysUntil } from "../../../lib/course-lifecycle";
import { getActiveLearnEnrollmentForUser } from "../../../lib/get-active-learn-enrollment";
import NavLogoWithBanner from "../../../components/NavLogoWithBanner";
import LearnNavTabs from "./LearnNavTabs";

export const dynamic = "force-dynamic";

type LearnLayoutProps = {
  params: Promise<{ enrollmentId: string }>;
  children: React.ReactNode;
};

export default async function LearnLayout({ params, children }: LearnLayoutProps) {
  const { enrollmentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  await guardStudentAccountOrRedirect(user.id);

  const enrollment = await getActiveLearnEnrollmentForUser(enrollmentId, user.id);
  if (!enrollment) notFound();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const profileFullName = (profileRow as { full_name?: string | null } | null)?.full_name?.trim();
  const studentDisplayName =
    profileFullName ||
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "") ||
    (user.email ? user.email.split("@")[0] : "") ||
    "Học viên";

  const courseName = enrollment.regular_course?.name ?? "Khóa học";
  const rc = enrollment.regular_course;
  const daysUntilCourseEnd = daysUntil(rc?.course_end_at ?? null);

  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[var(--container-max)] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <NavLogoWithBanner variant="light" />
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <p className="text-sm text-gray-600">
              Xin chào:{" "}
              <span className="font-medium text-[#002b2d]">{studentDisplayName}</span>.
            </p>
            <Link
              href="/student"
              className="text-sm text-gray-600 hover:text-[#002b2d]"
            >
              ← Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-[var(--container-max)] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-[#002b2d]">
            {courseName}
          </h1>
          {daysUntilCourseEnd != null && (
            <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700">
              Còn {daysUntilCourseEnd} ngày kết thúc khóa học
            </span>
          )}
        </div>

        <LearnNavTabs enrollmentId={enrollmentId} />

        <div className="mt-6">
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

