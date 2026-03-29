import { notFound } from "next/navigation";
import { AdminBreadcrumbStrip } from "../../../../../components/AdminHierarchyBreadcrumb";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import FinalExamManager from "./FinalExamManager";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FinalExamPage({ params }: PageProps) {
  const { id: baseCourseId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "admin") notFound();

  const admin = getSupabaseAdminClient();
  const { data: course } = await admin
    .from("base_courses")
    .select(`
      id,
      name,
      code,
      program:programs(id, name, code)
    `)
    .eq("id", baseCourseId)
    .single();

  if (!course) notFound();

  const programRaw = course.program as
    | { id: string; name: string; code?: string | null }
    | { id: string; name: string; code?: string | null }[]
    | null;
  const program = Array.isArray(programRaw) ? programRaw[0] ?? null : programRaw;

  const { data: finalExamData } = await admin
    .from("final_exams")
    .select("id, name")
    .eq("base_course_id", baseCourseId)
    .limit(1)
    .single();

  let finalExam = finalExamData;
  if (!finalExam) {
    const { data: created } = await admin
      .from("final_exams")
      .insert({ base_course_id: baseCourseId, name: "Bài kiểm tra tổng hợp" })
      .select("id, name")
      .single();
    finalExam = created;
  }

  const breadcrumbItems = [
    { label: "Chương trình", href: "/admin/programs" },
    ...(program?.id
      ? [{ label: program.name || "Chương trình", href: `/admin/programs/${program.id}` }]
      : []),
    { label: course.name ?? "Khóa học cơ bản", href: `/admin/base-courses/${baseCourseId}` },
    { label: "Bài thi cuối khóa" },
  ];

  return (
    <>
      <AdminBreadcrumbStrip items={breadcrumbItems} />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Bài thi cuối khóa
        </h1>
        <p className="mt-2 text-gray-400">
          {course.name} ({course.code})
        </p>

        <FinalExamManager
          baseCourseId={baseCourseId}
          finalExamId={finalExam!.id}
          finalExamName={finalExam!.name as string}
        />
      </main>
    </>
  );
}
