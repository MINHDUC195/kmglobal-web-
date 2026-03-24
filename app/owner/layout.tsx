import Link from "next/link";
import DashboardNav from "../../components/DashboardNav";
import Footer from "../../components/Footer";

export const dynamic = "force-dynamic";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Ông Chủ" />
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        {children}
      </main>
      <Footer hideLogo />
    </div>
  );
}
