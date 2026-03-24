"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LessonQuestionRow } from "@/lib/lesson-questions-data";
import { validateLessonQuestionContent } from "@/lib/lesson-question-validation";

type Props = {
  initialRows: LessonQuestionRow[];
};

function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len).trim() + "…";
}

/** Cần admin trả lời: chưa có reply, hoặc reply cuối từ học viên */
function needsReply(row: LessonQuestionRow): boolean {
  const replies = row.replies ?? [];
  if (replies.length === 0) return true;
  const last = replies[replies.length - 1];
  return last.user_id === row.user_id;
}

export default function AdminLessonQuestionsList({ initialRows }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedRow = selectedId ? initialRows.find((r) => r.id === selectedId) : null;

  function handleClickReply(row: LessonQuestionRow) {
    const ok = window.confirm(
      `Bạn muốn trả lời câu hỏi của học viên ${row.studentCode}?\n\nNội dung: "${truncate(row.content, 80)}"`
    );
    if (ok) {
      setSelectedId(row.id);
      setContent("");
      setError("");
    }
  }

  function handleBackToList() {
    setSelectedId(null);
    setContent("");
    setError("");
  }

  async function submitReply(questionId: string) {
    if (!content.trim() || submitting) return;
    const validation = validateLessonQuestionContent(content);
    if (!validation.valid) {
      setError(validation.error ?? "Nội dung không hợp lệ");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/lesson-questions/${questionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lỗi gửi trả lời");
        return;
      }
      handleBackToList();
      router.refresh();
    } catch {
      setError("Lỗi gửi trả lời");
    } finally {
      setSubmitting(false);
    }
  }

  if (initialRows.length === 0) {
    return (
      <p className="mt-8 text-gray-400">
        Chưa có câu hỏi nào từ học viên.
      </p>
    );
  }

  if (selectedRow) {
    return (
      <div className="mt-8 space-y-4">
        <button
          type="button"
          onClick={handleBackToList}
          className="flex items-center gap-2 text-sm font-medium text-[#D4AF37] hover:underline"
        >
          ← Quay lại danh sách
        </button>

        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white font-mono">{selectedRow.studentCode}</p>
              <p className="mt-1 text-xs text-gray-400">
                Chương trình: <span className="text-gray-300">{selectedRow.programName}</span>
                {" · "}
                Khóa: <span className="text-gray-300">{selectedRow.baseCourseName}</span>
                {" · "}
                Chương: <span className="text-gray-300">{selectedRow.chapterName}</span>
                {" · "}
                Bài: <span className="text-gray-300">{selectedRow.lessonName}</span>
              </p>
              <p className="mt-3 text-sm text-gray-200">{selectedRow.content}</p>
              <p className="mt-2 text-xs text-gray-500">
                {new Date(selectedRow.created_at).toLocaleString("vi-VN")} ·{" "}
                {needsReply(selectedRow) ? (
                  <span className="text-amber-400">Chưa trả lời</span>
                ) : (
                  <span className="text-emerald-400">Đã trả lời</span>
                )}
              </p>
            </div>
            <Link
              href={`/learn/preview/${selectedRow.lesson_id}`}
              className="shrink-0 rounded-full border border-[#D4AF37]/50 px-3 py-1.5 text-xs font-medium text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              Xem bài học
            </Link>
          </div>

          {selectedRow.replies.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Hội thoại
              </p>
              {selectedRow.replies.map((r) => (
                <div key={r.id} className="rounded-lg bg-black/20 p-3 text-sm text-gray-300">
                  {r.content}
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(r.created_at).toLocaleString("vi-VN")}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập câu trả lời..."
              rows={3}
              disabled={submitting}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]"
            />
            <p className="mt-1 text-xs text-gray-500">
              Không nhập số điện thoại, email, tài khoản mạng xã hội (Facebook, Instagram, Zalo, Telegram, WeChat...).
            </p>
            {error && <p className="mt-2 text-sm text-amber-400">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => submitReply(selectedRow.id)}
                disabled={!content.trim() || submitting}
                className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-50"
              >
                {submitting ? "Đang gửi..." : "Gửi trả lời"}
              </button>
              <button
                type="button"
                onClick={handleBackToList}
                disabled={submitting}
                className="rounded-full border border-white/20 px-5 py-2 text-sm text-gray-300 hover:bg-white/5 disabled:opacity-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-4 py-3 font-semibold text-[#D4AF37]">Mã HV</th>
              <th className="px-4 py-3 font-semibold text-[#D4AF37]">Nội dung</th>
              <th className="px-4 py-3 font-semibold text-[#D4AF37]">Khóa · Bài</th>
              <th className="px-4 py-3 font-semibold text-[#D4AF37]">Ngày</th>
              <th className="px-4 py-3 font-semibold text-[#D4AF37]">Trạng thái</th>
              <th className="px-4 py-3 font-semibold text-[#D4AF37] text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {initialRows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-white/5 hover:bg-white/5 transition"
              >
                <td className="px-4 py-3 font-mono text-white">{row.studentCode}</td>
                <td className="px-4 py-3 text-gray-300 max-w-[240px]">
                  {truncate(row.content, 60)}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {row.baseCourseName} · {row.lessonName}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(row.created_at).toLocaleDateString("vi-VN")}
                </td>
                <td className="px-4 py-3">
                  {needsReply(row) ? (
                    <span className="text-amber-400">Chưa trả lời</span>
                  ) : (
                    <span className="text-emerald-400">Đã trả lời</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/learn/preview/${row.lesson_id}`}
                    className="mr-2 text-xs text-[#D4AF37] hover:underline"
                  >
                    Xem bài
                  </Link>
                  {needsReply(row) ? (
                    <button
                      type="button"
                      onClick={() => handleClickReply(row)}
                      className="rounded-full bg-[#D4AF37]/15 px-4 py-1.5 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/25"
                    >
                      Trả lời
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className="rounded-full border border-[#D4AF37]/50 px-4 py-1.5 text-xs font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
                    >
                      Xem
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
