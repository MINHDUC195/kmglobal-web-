"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { StudentLessonQuestionReplyItem, StudentLessonQuestionThreadItem } from "../lib/lesson-questions-student";
import {
  markAllQuestionsSeen,
  markQuestionSeen,
  type QuestionReplySummaryItem,
} from "../lib/student-question-notifications";

type StudentQuestionThreadsProps = {
  initialThreads: StudentLessonQuestionThreadItem[];
};

function latestAdminReplyAt(replies: StudentLessonQuestionReplyItem[]): string | null {
  const adminReplies = replies.filter((r) => r.responderRole === "admin");
  if (!adminReplies.length) return null;
  return adminReplies[adminReplies.length - 1]?.created_at ?? null;
}

export default function StudentQuestionThreads({ initialThreads }: StudentQuestionThreadsProps) {
  const [threads, setThreads] = useState(initialThreads);
  const [draftByQuestionId, setDraftByQuestionId] = useState<Record<string, string>>({});
  const [openReplyByQuestionId, setOpenReplyByQuestionId] = useState<Record<string, boolean>>({});
  const [sendingQuestionId, setSendingQuestionId] = useState<string | null>(null);

  const replySummary = useMemo<QuestionReplySummaryItem[]>(
    () =>
      threads
        .map((thread) => {
          const latest = latestAdminReplyAt(thread.replies);
          if (!latest) return null;
          return { questionId: thread.id, latestAdminReplyAt: latest };
        })
        .filter((v): v is QuestionReplySummaryItem => Boolean(v)),
    [threads]
  );

  useEffect(() => {
    markAllQuestionsSeen(replySummary);
  }, [replySummary]);

  async function handleReplySubmit(questionId: string) {
    const content = (draftByQuestionId[questionId] ?? "").trim();
    if (!content || sendingQuestionId) return;
    setSendingQuestionId(questionId);
    try {
      const res = await fetch(`/api/lesson-questions/${questionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        reply?: { id: string; content: string; created_at: string };
      };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || "Gửi phản hồi thất bại");
      }
      setThreads((prev) =>
        prev.map((t) =>
          t.id === questionId
            ? {
                ...t,
                replies: [
                  ...t.replies,
                  {
                    id: data.reply!.id,
                    content: data.reply!.content,
                    created_at: data.reply!.created_at,
                    responderName: "Bạn",
                    responderRole: "student",
                  },
                ],
              }
            : t
        )
      );
      setDraftByQuestionId((prev) => ({ ...prev, [questionId]: "" }));
      setOpenReplyByQuestionId((prev) => ({ ...prev, [questionId]: false }));
    } catch {
      // Keep it silent for now; user can retry.
    } finally {
      setSendingQuestionId(null);
    }
  }

  if (!threads.length) {
    return (
      <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-gray-400">Bạn chưa gửi câu hỏi nào trong các bài học.</p>
        <Link
          href="/student"
          className="mt-4 inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
        >
          Về dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {threads.map((q) => {
        const href = q.enrollmentId
          ? `/learn/preview/${q.lesson_id}?enrollmentId=${encodeURIComponent(q.enrollmentId)}`
          : `/learn/preview/${q.lesson_id}`;
        const latestAdminAt = latestAdminReplyAt(q.replies);
        const isOpenReply = openReplyByQuestionId[q.id] ?? false;
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
                  q.replies.some((r) => r.responderRole === "admin")
                    ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border border-amber-500/40 bg-amber-500/10 text-amber-300"
                }`}
              >
                {q.replies.some((r) => r.responderRole === "admin") ? "Đã phản hồi" : "Chờ phản hồi"}
              </span>
            </div>

            <div
              className="mt-4 rounded-lg border border-[#1E365A] bg-[#071225] p-4"
              onClick={() => {
                if (latestAdminAt) {
                  markQuestionSeen(q.id, latestAdminAt);
                }
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[#D4AF37]">Trao đổi</p>
              <p className="mt-2 text-sm text-gray-100">
                <span className="font-semibold text-gray-300">Bạn:</span> {q.content}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {new Date(q.created_at).toLocaleDateString("vi-VN")}
              </p>

              <div className="mt-3 space-y-2">
                {q.replies.length > 0 ? (
                  q.replies.map((rep) => (
                    <div key={rep.id} className="rounded-lg border border-white/10 bg-[#0a1628]/70 px-3 py-2">
                      <p className="text-xs text-[#9FB3C8]">
                        {rep.responderRole === "admin" ? "Admin" : "Bạn"} ·{" "}
                        {new Date(rep.created_at).toLocaleDateString("vi-VN")}
                      </p>
                      <p className="mt-1 text-sm text-gray-200">{rep.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">Admin chưa phản hồi câu hỏi này.</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setOpenReplyByQuestionId((prev) => ({
                    ...prev,
                    [q.id]: !prev[q.id],
                  }))
                }
                className="rounded-full border border-[#D4AF37]/50 px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                Phản hồi lại
              </button>
              <Link href={href} className="text-sm font-medium text-[#D4AF37] hover:underline">
                Xem trong bài học →
              </Link>
            </div>

            {isOpenReply && (
              <div className="mt-3">
                <textarea
                  value={draftByQuestionId[q.id] ?? ""}
                  onChange={(e) =>
                    setDraftByQuestionId((prev) => ({
                      ...prev,
                      [q.id]: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Nhập nội dung phản hồi..."
                  className="w-full rounded-lg border border-[#1E365A] bg-[#071225] px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#2A4D77]"
                />
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => void handleReplySubmit(q.id)}
                    disabled={sendingQuestionId === q.id || !(draftByQuestionId[q.id] ?? "").trim()}
                    className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#E7C768] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendingQuestionId === q.id ? "Đang gửi..." : "Gửi phản hồi"}
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
