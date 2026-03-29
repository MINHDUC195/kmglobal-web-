import { createServerSupabaseClient } from "../../lib/supabase-server";
import DashboardNav from "../../components/DashboardNav";
import Footer from "../../components/Footer";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let greeting = "Admin";
  let initialDisplayName: string | null = null;
  let showStudentHubLink = false;
  let showOwnerHubLink = false;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, student_hub_eligible, full_name")
      .eq("id", user.id)
      .single();
    const p = profile as {
      role?: string;
      student_hub_eligible?: boolean | null;
      full_name?: string | null;
    } | null;
    const role = p?.role;
    if (role === "owner") {
      greeting = "Ông Chủ";
      showOwnerHubLink = true;
    }
    initialDisplayName =
      p?.full_name?.trim() ||
      (user.email ? user.email.split("@")[0] : null) ||
      null;
    if (role === "admin" && p?.student_hub_eligible === true) {
      showStudentHubLink = true;
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav
        greeting={greeting}
        initialDisplayName={initialDisplayName}
        showStudentHubLink={showStudentHubLink}
        showOwnerHubLink={showOwnerHubLink}
      />
      {children}
      <Footer hideLogo />
    </div>
  );
}
