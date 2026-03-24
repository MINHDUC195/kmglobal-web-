import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardNav from "../../../components/DashboardNav";
import Footer from "../../../components/Footer";
import AdminLessonQuestionsList from "../../../components/AdminLessonQuestionsList";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { loadAllLessonQuestionsForAdmin } from "../../../lib/lesson-questions-data";

export const dynamic = "force-dynamic";

export default async function AdminLessonQuestionsPage() {
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

  const rows = await loadAllLessonQuestionsForAdmin();

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Admin" />

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
      </main>

      <Footer hideLogo />
    </div>
  );
}
