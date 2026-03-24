import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBreadcrumbStrip } from "../../../../components/AdminHierarchyBreadcrumb";
import DashboardNav from "../../../../components/DashboardNav";
import Footer from "../../../../components/Footer";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import ProgramBaseCoursesTable from "./ProgramBaseCoursesTable";

type ProgramDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProgramDetailPage({ params }: ProgramDetailPageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: program, error } = await supabase
    .from("programs")
    .select("*, approval_status")
    .eq("id", id)
    .single();

  if (error || !program) {
    notFound();
  }

  const isApproved = (program as { approval_status?: string }).approval_status === "approved";

  const { data: baseCourses } = await supabase
    .from("base_courses")
    .select("id, code, name, summary, difficulty_level")
    .eq("program_id", id)
    .order("created_at", { ascending: true });

  const programBreadcrumb = [
    { label: "Chương trình", href: "/admin/programs" },
    { label: program.name ?? "Chi tiết chương trình" },
  ];

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Admin" />
      <AdminBreadcrumbStrip items={programBreadcrumb} />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
              {program.name}
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Mã: {program.code || "-"} · Số khóa cơ bản: {baseCourses?.length ?? 0}
              {isApproved && (
                <span className="ml-2 rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                  Đã phê duyệt
                </span>
              )}
            </p>
          </div>
          {!isApproved && (
            <Link
              href={`/admin/programs/${id}/base-courses/new`}
              className="rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
            >
              + Thêm khóa học cơ bản
            </Link>
          )}
        </div>

        {program.note && (
          <p className="mt-4 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
            {program.note}
          </p>
        )}

        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-white">Khóa học cơ bản</h2>
          <ProgramBaseCoursesTable
            baseCourses={baseCourses ?? []}
            isApproved={isApproved}
          />
        </div>
      </main>

      <Footer hideLogo />
    </div>
  );
}
