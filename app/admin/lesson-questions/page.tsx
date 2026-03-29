import Link from "next/link";
import { redirect } from "next/navigation";
import AdminLessonQuestionsList from "../../../components/AdminLessonQuestionsList";
import ListPagination from "../../../components/ListPagination";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { loadLessonQuestionsForAdminPage } from "../../../lib/lesson-questions-data";
import { parsePageParam } from "../../../lib/list-pagination";

export const dynamic = "force-dynamic";

export default async function AdminLessonQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const q = await searchParams;
  const page = parsePageParam(q.page);
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?to=/admin/lesson-questions");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string } | null)?.role;
  if (role !== "owner" && role !== "admin") {
    redirect("/student");
  }

  const pageData = await loadLessonQuestionsForAdminPage({ page, pageSize: 20 });
  const rows = pageData.rows;

  return (
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <Link
          href="/admin"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#D4AF37] hover:underline"
        >
          ← Quay về Dashboard
        </Link>

        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Hỏi đáp bài học
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Câu hỏi từ học viên theo chương trình, khóa học và bài học. Trả lời để học viên xem trên Dashboard.
        </p>

        <AdminLessonQuestionsList initialRows={rows} />
        <ListPagination
          page={pageData.meta.page}
          totalPages={pageData.meta.totalPages}
          totalItems={pageData.meta.total}
          pageSize={pageData.meta.pageSize}
          basePath="/admin/lesson-questions"
        />
      </main>
  );
}
