import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../lib/supabase-server";
import DashboardNav from "../../components/DashboardNav";
import Footer from "../../components/Footer";

export const dynamic = "force-dynamic";

export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?to=/owner");
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const navDisplayName =
    (profileRow as { full_name?: string | null } | null)?.full_name?.trim() ||
    (user.email ? user.email.split("@")[0] : "") ||
    "Ông Chủ";

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Ông Chủ" initialDisplayName={navDisplayName} />
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        {children}
      </main>
      <Footer hideLogo />
    </div>
  );
}
