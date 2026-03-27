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
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const navDisplayName =
    (profileRow as { full_name?: string | null } | null)?.full_name?.trim() ||
    (user.email ? user.email.split("@")[0] : "") ||
    "Học viên";

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Học viên" showExploreCourses initialDisplayName={navDisplayName} />
      <StudentNav />
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-8 sm:px-6">
        {children}
      </main>
      <Footer hideLogo />
    </div>
  );
}
