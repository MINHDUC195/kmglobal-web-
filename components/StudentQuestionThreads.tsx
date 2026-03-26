"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type {
  StudentLessonQuestionItem,
  StudentLessonQuestionReplyItem,
} from "../lib/lesson-questions-student";
import {
  getSeenAt,
  markQuestionSeen,
  type QuestionReplySummaryItem,
} from "../lib/student-question-notifications";

type StudentQuestionThreadsProps = {
  initialQuestions: StudentLessonQuestionItem[];
};

type ThreadDetail = {
  question: { id: string; content: string; created_at: string };
  replies: StudentLessonQuestionReplyItem[];
};

export default function StudentQuestionThreads({ initialQuestions }: StudentQuestionThreadsProps) {
  const [questions] = useState(initialQuestions);
  const [detailsByQuestionId, setDetailsByQuestionId] = useState<Record<string, ThreadDetail>>({});
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [loadingDetailQuestionId, setLoadingDetailQuestionId] = useState<string | null>(null);
  const [replySummary, setReplySummary] = useState<QuestionReplySummaryItem[]>([]);
  const [draftByQuestionId, setDraftByQuestionId] = useState<Record<string, string>>({});
  const [openReplyByQuestionId, setOpenReplyByQuestionId] = useState<Record<string, boolean>>({});
  const [sendingQuestionId, setSendingQuestionId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadReplySummary() {
      try {
        const res = await fetch("/api/student/questions/reply-count", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: QuestionReplySummaryItem[] };
        if (mounted) {
          setReplySummary(data.items ?? []);
        }
      } catch {
        if (mounted) setReplySummary([]);
      }
    }

    void loadReplySummary();
    return () => {
      mounted = false;
    };
  }, []);

  const replySummaryByQuestionId = useMemo(() => {
    return new Map(replySummary.map((i) => [i.questionId, i.latestAdminReplyAt]));
  }, [replySummary]);

  function isUnread(questionId: string): boolean {
    const latestAdminAt = replySummaryByQuestionId.get(questionId);
    if (!latestAdminAt) return false;
    const seenAt = getSeenAt(questionId);
    return !seenAt || Date.parse(seenAt) < Date.parse(latestAdminAt);
  }

  async function handleToggleDetail(questionId: string) {
    if (expandedQuestionId === questionId) {
      setExpandedQuestionId(null);
      return;
    }
    setExpandedQuestionId(questionId);
    const latestAdminAt = replySummaryByQuestionId.get(questionId);
    if (latestAdminAt) {
      markQuestionSeen(questionId, latestAdminAt);
      setReplySummary((prev) => [...prev]);
    }
    if (detailsByQuestionId[questionId]) return;
    setLoadingDetailQuestionId(questionId);
    try {
      const res = await fetch(`/api/student/questions/${questionId}/thread`, {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        question?: { id: string; content: string; created_at: string };
        replies?: StudentLessonQuestionReplyItem[];
      };
      if (!res.ok || !data.question) return;
      setDetailsByQuestionId((prev) => ({
        ...prev,
        [questionId]: {
          question: data.question!,
          replies: data.replies ?? [],
        },
      }));
    } finally {
      setLoadingDetailQuestionId(null);
    }
  }

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
      setDetailsByQuestionId((prev) => {
        const current = prev[questionId];
        if (!current) return prev;
        return {
          ...prev,
          [questionId]: {
            ...current,
            replies: [
              ...current.replies,
              {
                id: data.reply!.id,
                content: data.reply!.content,
                created_at: data.reply!.created_at,
                responderName: "Bạn",
                responderRole: "student",
              },
            ],
          },
        };
      });
      setDraftByQuestionId((prev) => ({ ...prev, [questionId]: "" }));
      setOpenReplyByQuestionId((prev) => ({ ...prev, [questionId]: false }));
    } catch {
      // Keep it silent for now; user can retry.
    } finally {
      setSendingQuestionId(null);
    }
  }

  if (!questions.length) {
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
    <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-white/5">
      <div className="grid grid-cols-[72px_minmax(0,1.6fr)_minmax(0,1fr)_120px_120px] gap-3 border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#9FB3C8]">
        <span>STT</span>
        <span>Câu hỏi</span>
        <span>Tóm tắt</span>
        <span>Trạng thái</span>
        <span>Hành động</span>
      </div>
      {questions.map((q, idx) => {
        const href = q.enrollmentId
          ? `/learn/preview/${q.lesson_id}?enrollmentId=${encodeURIComponent(q.enrollmentId)}`
          : `/learn/preview/${q.lesson_id}`;
        const detail = detailsByQuestionId[q.id];
        const isExpanded = expandedQuestionId === q.id;
        const unread = isUnread(q.id);
        const isOpenReply = openReplyByQuestionId[q.id] ?? false;
        return (
          <article
            key={q.id}
            className="border-b border-white/10 last:border-b-0"
          >
            <div className="grid grid-cols-[72px_minmax(0,1.6fr)_minmax(0,1fr)_120px_120px] items-center gap-3 px-4 py-3">
              <span className="text-sm font-semibold text-gray-300">{idx + 1}</span>
              <button
                type="button"
                onClick={() => void handleToggleDetail(q.id)}
                className="min-w-0 text-left"
                title={q.content}
              >
                <p className="truncate text-sm font-semibold text-white">{q.content}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(q.created_at).toLocaleDateString("vi-VN")}
                </p>
              </button>
              <p className="truncate text-xs text-gray-400">
                {q.programName} · {q.baseCourseName} · {q.lessonName}
              </p>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    q.hasReplies
                      ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border border-amber-500/40 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  {q.hasReplies ? "Đã phản hồi" : "Chờ phản hồi"}
                </span>
                {unread && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Mới</span>}
              </div>
              <button
                type="button"
                onClick={() => void handleToggleDetail(q.id)}
                className="rounded-full border border-[#D4AF37]/50 px-3 py-1.5 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                {isExpanded ? "Thu gọn" : "Chi tiết"}
              </button>
            </div>

            {isExpanded && (
              <div className="border-t border-[#1E365A] bg-[#081427] px-4 py-4">
                {loadingDetailQuestionId === q.id ? (
                  <div className="h-28 animate-pulse rounded-lg border border-[#1E365A] bg-[#071225]" />
                ) : detail ? (
                  <>
                    <div className="rounded-lg border border-[#1E365A] bg-[#071225] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#D4AF37]">
                        Trao đổi
                      </p>
                      <p className="mt-2 text-sm text-gray-100">
                        <span className="font-semibold text-gray-300">Bạn:</span> {detail.question.content}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {new Date(detail.question.created_at).toLocaleDateString("vi-VN")}
                      </p>

                      <div className="mt-3 space-y-2">
                        {detail.replies.length > 0 ? (
                          detail.replies.map((rep) => (
                            <div
                              key={rep.id}
                              className="rounded-lg border border-white/10 bg-[#0a1628]/70 px-3 py-2"
                            >
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
                            disabled={
                              sendingQuestionId === q.id || !(draftByQuestionId[q.id] ?? "").trim()
                            }
                            className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#E7C768] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {sendingQuestionId === q.id ? "Đang gửi..." : "Gửi phản hồi"}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Không tải được nội dung chi tiết.</p>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
