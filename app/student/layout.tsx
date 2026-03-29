import { createServerSupabaseClient } from "../../lib/supabase-server";
import { redirect } from "next/navigation";
import DashboardNav from "../../components/DashboardNav";
import Footer from "../../components/Footer";
import StudentNav from "../../components/StudentNav";
import { guardStudentAccountOrRedirect } from "../../lib/student-account-guard";

export const dynamic = "force-dynamic";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?to=/student");
  }

  await guardStudentAccountOrRedirect(user.id);

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, role, student_hub_eligible")
    .eq("id", user.id)
    .maybeSingle();
  const p = profileRow as {
    full_name?: string | null;
    role?: string | null;
    student_hub_eligible?: boolean | null;
  } | null;
  const navDisplayName =
    p?.full_name?.trim() ||
    (user.email ? user.email.split("@")[0] : "") ||
    "Học viên";
  const showAdminHubLink = p?.role === "admin" && p?.student_hub_eligible === true;

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav
        greeting="Học viên"
        showExploreCourses
        initialDisplayName={navDisplayName}
        showAdminHubLink={showAdminHubLink}
      />
      <StudentNav />
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-8 sm:px-6">
        {children}
      </main>
      <Footer hideLogo />
    </div>
  );
}
