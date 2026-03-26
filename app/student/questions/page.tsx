import Link from "next/link";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { loadLessonQuestionThreadsForStudent } from "../../../lib/lesson-questions-student";

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

      {threads.length === 0 ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-gray-400">Bạn chưa gửi câu hỏi nào trong các bài học.</p>
          <Link
            href="/student"
            className="mt-4 inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            Về dashboard
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {threads.map((q) => {
            const href = q.enrollmentId
              ? `/learn/preview/${q.lesson_id}?enrollmentId=${encodeURIComponent(q.enrollmentId)}`
              : `/learn/preview/${q.lesson_id}`;
            return (
              <article
                key={q.id}
                className="rounded-xl border border-white/10 bg-white/5 p-5 transition hover:bg-white/[0.07]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-gray-400">
                    {q.programName} · {q.baseCourseName} · {q.lessonName}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      q.replies.length > 0
                        ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                        : "border border-amber-500/40 bg-amber-500/10 text-amber-300"
                    }`}
                  >
                    {q.replies.length > 0 ? "Đã phản hồi" : "Chờ phản hồi"}
                  </span>
                </div>

                <div className="mt-4 rounded-lg border border-white/10 bg-[#0a1628]/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#D4AF37]">Câu hỏi của bạn</p>
                  <p className="mt-2 text-sm text-gray-100">{q.content}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {new Date(q.created_at).toLocaleDateString("vi-VN")}
                  </p>
                </div>

                <div className="mt-4 space-y-3">
                  {q.replies.length > 0 ? (
                    q.replies.map((rep) => (
                      <div
                        key={rep.id}
                        className="rounded-lg border border-[#1E365A] bg-[#071225] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-[#9FB3C8]">
                            {rep.responderRole === "admin" ? "Phản hồi từ Admin" : "Phản hồi"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(rep.created_at).toLocaleDateString("vi-VN")}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-gray-200">{rep.content}</p>
                        <p className="mt-2 text-xs text-gray-500">Người trả lời: {rep.responderName}</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg border border-white/10 bg-[#071225] px-4 py-3 text-sm text-gray-400">
                      Admin chưa phản hồi câu hỏi này.
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <Link href={href} className="text-sm font-medium text-[#D4AF37] hover:underline">
                    Xem trong bài học →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
