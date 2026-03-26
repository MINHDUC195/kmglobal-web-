"use client";

import { useCallback, useEffect, useState } from "react";
import { validateLessonQuestionContent } from "../lib/lesson-question-validation";

type Reply = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type LessonQuestion = {
  id: string;
  lesson_id: string;
  user_id: string;
  content: string;
  status: string;
  created_at: string;
  replies: Reply[];
};

type LessonQASectionProps = {
  lessonId: string;
  enrollmentId: string | null;
  lessonName: string;
  variant?: "light" | "dark";
};

export default function LessonQASection({
  lessonId,
  enrollmentId,
  lessonName,
  variant = "light",
}: LessonQASectionProps) {
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  const isLight = variant === "light";

  const loadQuestions = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/lesson-questions?lessonId=${encodeURIComponent(lessonId)}&enrollmentId=${encodeURIComponent(enrollmentId)}`
      );
      if (res.ok) {
        const { questions: qs } = await res.json();
        setQuestions(qs ?? []);
      } else {
        setQuestions([]);
      }
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [lessonId, enrollmentId]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || submitting || !enrollmentId) return;
    const validation = validateLessonQuestionContent(content);
    if (!validation.valid) {
      setError(validation.error ?? "Nội dung không hợp lệ");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/lesson-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          enrollmentId,
          content: content.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lỗi gửi câu hỏi");
        return;
      }
      setContent("");
      void loadQuestions();
    } catch {
      setError("Lỗi gửi câu hỏi");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(questionId: string) {
    if (!replyContent.trim() || replySubmitting) return;
    const validation = validateLessonQuestionContent(replyContent);
    if (!validation.valid) {
      setError(validation.error ?? "Nội dung không hợp lệ");
      return;
    }
    setError("");
    setReplySubmitting(true);
    try {
      const res = await fetch(`/api/lesson-questions/${questionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lỗi gửi trả lời");
        return;
      }
      setReplyingTo(null);
      setReplyContent("");
      void loadQuestions();
    } catch {
      setError("Lỗi gửi trả lời");
    } finally {
      setReplySubmitting(false);
    }
  }

  if (!enrollmentId) return null;

  const containerCls = isLight
    ? "rounded-xl border border-[#D9E2EC] bg-white p-6 shadow-sm"
    : "rounded-xl border border-white/10 bg-white/5 p-6";
  const titleCls = isLight ? "text-[#0F2D4A]" : "text-white";
  const textCls = isLight ? "text-[#334E68]" : "text-gray-200";
  const inputCls = isLight
    ? "w-full rounded-xl border border-[#BCCCDC] bg-[#F8FAFC] px-4 py-3 text-[#102A43] outline-none focus:border-[#486581]"
    : "w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]";
  const cardCls = isLight
    ? "rounded-lg border border-[#D9E2EC] bg-[#F8FAFC] p-4"
    : "rounded-lg border border-white/10 bg-white/5 p-4";

  return (
    <section className={containerCls}>
      <h2 className={`mb-4 text-lg font-semibold ${titleCls}`}>Hỏi đáp bài học</h2>
      <p className={`mb-4 text-sm ${textCls}`}>
        Đặt câu hỏi về bài &quot;{lessonName}&quot;. Admin sẽ trả lời và thông báo cho bạn.
      </p>

      <form onSubmit={handleSubmit} className="mb-6">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nhập câu hỏi của bạn..."
          rows={3}
          disabled={submitting}
          className={inputCls}
        />
        <p className={`mt-2 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
          Không nhập số điện thoại, email, tài khoản mạng xã hội (Facebook, Instagram, Zalo, Telegram, WeChat...).
        </p>
        {error && <p className="mt-2 text-sm text-[#B7791F]">{error}</p>}
        <button
          type="submit"
          disabled={!content.trim() || submitting}
          className="mt-3 rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-50"
        >
          {submitting ? "Đang gửi..." : "Gửi câu hỏi"}
        </button>
      </form>

      {loading ? (
        <p className={textCls}>Đang tải câu hỏi...</p>
      ) : questions.length === 0 ? (
        <p className={`text-sm ${isLight ? "text-gray-500" : "text-gray-400"}`}>
          Chưa có câu hỏi nào. Hãy đặt câu hỏi đầu tiên!
        </p>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className={cardCls}>
              <p className={`text-sm font-medium ${textCls}`}>{q.content}</p>
              <p className={`mt-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                {new Date(q.created_at).toLocaleDateString("vi-VN")} ·{" "}
                {q.status === "answered" ? "Đã trả lời" : "Chờ trả lời"}
              </p>
              {q.replies.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-gray-200 pt-3 dark:border-white/10">
                  {q.replies.map((r) => (
                    <div key={r.id} className="rounded border border-[#D9E2EC] bg-white p-2 dark:bg-white/5">
                      <p className={`text-sm ${textCls}`}>{r.content}</p>
                      <p className={`mt-1 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                        {new Date(r.created_at).toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3">
                {replyingTo === q.id ? (
                  <div>
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Trả lời thêm..."
                      rows={2}
                      disabled={replySubmitting}
                      className={inputCls}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReply(q.id)}
                        disabled={!replyContent.trim() || replySubmitting}
                        className="rounded-full bg-[#D4AF37] px-4 py-1.5 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-50"
                      >
                        {replySubmitting ? "Đang gửi..." : "Gửi trả lời"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent("");
                        }}
                        className="rounded-full border border-[#BCCCDC] px-4 py-1.5 text-sm text-[#334E68] hover:bg-[#F0F4F8] dark:border-white/20 dark:text-gray-400"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReplyingTo(q.id)}
                    className="text-sm font-medium text-[#D4AF37] hover:underline"
                  >
                    Trả lời thêm
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
