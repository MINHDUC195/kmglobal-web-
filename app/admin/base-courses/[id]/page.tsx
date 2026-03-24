import { notFound } from "next/navigation";
import { AdminBreadcrumbStrip } from "../../../../components/AdminHierarchyBreadcrumb";
import DashboardNav from "../../../../components/DashboardNav";
import Footer from "../../../../components/Footer";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import BaseCourseDetail from "./BaseCourseDetail";

type BaseCoursePageProps = {
  params: Promise<{ id: string }>;
};

export default async function BaseCoursePage({ params }: BaseCoursePageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: course, error } = await supabase
    .from("base_courses")
    .select(`
      *,
      program:programs(id, name, code, approval_status)
    `)
    .eq("id", id)
    .single();

  if (error || !course) {
    notFound();
  }

  const { data: chapters } = await supabase
    .from("chapters")
    .select(`
      id,
      sort_order,
      name,
      objectives,
      weight_percent,
      lessons(id, sort_order, name, description, video_url, document_url)
    `)
    .eq("base_course_id", id)
    .order("sort_order", { ascending: true });

  const chaptersWithSortedLessons = (chapters ?? []).map((ch) => ({
    ...ch,
    lessons: (ch.lessons ?? []).sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order
    ),
  }));

  const program = course.program as { id: string; name: string } | null;
  const baseCourseBreadcrumb = [
    { label: "Chương trình", href: "/admin/programs" },
    ...(program?.id
      ? [{ label: program.name || "Chương trình", href: `/admin/programs/${program.id}` }]
      : []),
    { label: course.name ?? "Khóa học cơ bản" },
  ];

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Admin" />
      <AdminBreadcrumbStrip items={baseCourseBreadcrumb} />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <BaseCourseDetail
          course={course}
          chapters={chaptersWithSortedLessons}
          isReadOnly={(course.program as { approval_status?: string })?.approval_status === "approved"}
        />
      </main>

      <Footer hideLogo />
    </div>
  );
}
