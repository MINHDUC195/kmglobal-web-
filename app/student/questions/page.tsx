import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { loadLessonQuestionThreadsForStudent } from "../../../lib/lesson-questions-student";
import StudentQuestionThreads from "../../../components/StudentQuestionThreads";

export const dynamic = "force-dynamic";

export default async function StudentQuestionsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const threads = await loadLessonQuestionThreadsForStudent(user.id);

  return (
    <>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Câu hỏi và Trả lời
      </h1>
      <p className="mt-2 text-gray-400">
        Tổng hợp tất cả câu hỏi bạn đã gửi ở các khóa học và phần phản hồi từ admin.
      </p>

      <StudentQuestionThreads initialThreads={threads} />
    </>
  );
}
