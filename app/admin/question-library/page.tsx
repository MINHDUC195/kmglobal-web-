import Link from "next/link";
import { Suspense } from "react";
import DashboardNav from "../../../components/DashboardNav";
import Footer from "../../../components/Footer";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { HIDE_FROM_LIBRARY_TAG } from "../../../lib/question-tags";
import QuestionLibraryClient from "./QuestionLibraryClient";

export const dynamic = "force-dynamic";

const DIFFICULTY_OPTIONS = [
  { value: "dễ", label: "Dễ" },
  { value: "trung bình", label: "Trung bình" },
  { value: "khó", label: "Khó" },
];

type PageProps = {
  searchParams: Promise<{ programId?: string; difficulty?: string }>;
};

export default async function QuestionLibraryPage({ searchParams }: PageProps) {
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;
  const programId = params.programId || "";
  const difficulty = params.difficulty || "";

  let query = supabase
    .from("questions")
    .select("id, code, content, type, points, max_attempts, tags, program_id, difficulty_level, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (programId) query = query.eq("program_id", programId);
  if (difficulty) query = query.eq("difficulty_level", difficulty);

  const { data: rawQuestions } = await query;
  const questions = (rawQuestions ?? []).filter(
    (q) => !q.tags?.includes(HIDE_FROM_LIBRARY_TAG)
  );

  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, code")
    .order("name");

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
        <div className="flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
            Thư viện câu hỏi
          </h1>
          <Link
            href={
              programId
                ? `/admin/question-library/new?programId=${encodeURIComponent(programId)}`
                : "/admin/question-library/new"
            }
            className="rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
          >
            + Thêm câu hỏi
          </Link>
        </div>

        <p className="mt-2 text-sm text-gray-400">
          Soạn câu hỏi trắc nghiệm; mã câu tạo tự động theo chương trình và khóa học. Không gửi đáp án đúng về frontend.
        </p>

        <Suspense fallback={<p className="mt-6 text-sm text-gray-500">Đang tải...</p>}>
          <QuestionLibraryClient
            initialQuestions={questions ?? []}
            programs={programs ?? []}
            difficultyOptions={DIFFICULTY_OPTIONS}
            selectedProgramId={programId}
            selectedDifficulty={difficulty}
          />
        </Suspense>
      </main>

      <Footer hideLogo />
    </div>
  );
}
