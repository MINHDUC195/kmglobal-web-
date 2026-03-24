import { notFound } from "next/navigation";
import type { AdminBreadcrumbItem } from "../../../../components/AdminHierarchyBreadcrumb";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import FinalExamClient from "./FinalExamClient";

export const dynamic = "force-dynamic";

type ExamPageProps = {
  params: Promise<{ enrollmentId: string }>;
};

export default async function ExamPage({ params }: ExamPageProps) {
  const { enrollmentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const admin = getSupabaseAdminClient();

  const { data: enrollment, error: eErr } = await admin
    .from("enrollments")
    .select(`
      id,
      regular_course_id,
      regular_course:regular_courses(id, name, base_course:base_courses(id))
    `)
    .eq("id", enrollmentId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (eErr || !enrollment) notFound();

  const baseCourseId = (enrollment.regular_course as { base_course?: { id?: string } } | null)?.base_course?.id;
  if (!baseCourseId) notFound();

  const { data: finalExam } = await admin
    .from("final_exams")
    .select("id, name")
    .eq("base_course_id", baseCourseId)
    .limit(1)
    .single();

  if (!finalExam) notFound();

  const courseName = (enrollment.regular_course as { name?: string } | null)?.name ?? "Khóa học";

  const examBreadcrumb: AdminBreadcrumbItem[] = [
    { label: courseName, href: `/learn/${enrollmentId}` },
    { label: (finalExam.name as string) || "Bài thi cuối khóa" },
  ];

  return (
    <FinalExamClient
      enrollmentId={enrollmentId}
      finalExamId={finalExam.id}
      examName={finalExam.name as string}
      courseName={courseName}
      breadcrumbItems={examBreadcrumb}
    />
  );
}
