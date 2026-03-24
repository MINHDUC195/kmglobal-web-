"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Question = {
  id: string;
  content: string;
  type: string;
  points: number;
};

type FinalExamManagerProps = {
  baseCourseId: string;
  finalExamId: string;
  finalExamName: string;
};

export default function FinalExamManager({ baseCourseId }: FinalExamManagerProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  /** null | library: panel chọn từ thư viện (thủ công = link sang trang soạn câu) */
  const [addingMode, setAddingMode] = useState<null | "library">(null);
  const [libraryQuestions, setLibraryQuestions] = useState<Question[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/final-exam/questions?baseCourseId=${baseCourseId}`
      );
      if (!res.ok) throw new Error("Không tải được");
      const data = await res.json();
      setQuestions(data.questions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }, [baseCourseId]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  async function handleAddQuestion(questionId: string) {
    setError("");
    try {
      const res = await fetch("/api/admin/final-exam/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCourseId, questionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi");
      setAddingMode(null);
      setLibraryQuestions([]);
      void loadQuestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi thêm câu hỏi");
    }
  }

  async function handleRemove(questionId: string) {
    if (!confirm("Gỡ câu hỏi khỏi bài thi?")) return;
    setError("");
    try {
      const res = await fetch(
        `/api/admin/final-exam/questions?baseCourseId=${baseCourseId}&questionId=${questionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Lỗi");
      void loadQuestions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    }
  }

  async function searchLibrary(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      const res = await fetch(`/api/admin/question-library/list?${params.toString()}`);
      const data = await res.json();
      setLibraryQuestions(data.questions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tìm kiếm");
    }
  }

  const existingIds = new Set(questions.map((q) => q.id));

  return (
    <div className="mt-8 space-y-6">
      {error && (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="font-semibold text-white">Câu hỏi trong bài thi ({questions.length})</h2>
        {loading ? (
          <p className="mt-4 text-gray-400">Đang tải...</p>
        ) : questions.length === 0 ? (
          <p className="mt-4 text-amber-400/90">
            Chưa có câu hỏi. Chọn <strong className="text-amber-300">Thêm câu hỏi thủ công</strong> để soạn mới
            (có thể lưu vào thư viện), hoặc <strong className="text-amber-300">Thêm từ thư viện</strong> để chọn
            câu có sẵn.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {questions.map((q, idx) => (
              <li
                key={q.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-[#0b1323] p-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm text-gray-500">Câu {idx + 1}. </span>
                  <span className="text-gray-200">{q.content.slice(0, 120)}{q.content.length > 120 ? "…" : ""}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(q.id)}
                  className="shrink-0 rounded px-2 py-1 text-sm text-red-400 hover:bg-red-500/10"
                >
                  Gỡ
                </button>
              </li>
            ))}
          </ul>
        )}

        {addingMode !== "library" ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/admin/question-library/new?baseCourseId=${encodeURIComponent(baseCourseId)}&fromFinalExam=1`}
              className="inline-flex items-center justify-center rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
            >
              Thêm câu hỏi thủ công
            </Link>
            <button
              type="button"
              onClick={() => setAddingMode("library")}
              className="rounded-full border border-[#D4AF37]/60 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              Thêm câu hỏi từ thư viện
            </button>
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-white/10 bg-[#0b1323] p-4">
            <p className="mb-3 text-sm font-medium text-white">Chọn từ thư viện câu hỏi</p>
            <form onSubmit={searchLibrary} className="flex gap-2">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo nội dung..."
                className="flex-1 rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2 text-white placeholder-gray-500"
              />
              <button
                type="submit"
                className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black"
              >
                Tìm
              </button>
            </form>
            <Link
              href="/admin/question-library"
              className="mt-2 inline-block text-sm text-[#D4AF37] hover:underline"
            >
              Mở thư viện câu hỏi →
            </Link>
            <div className="mt-4 max-h-48 overflow-y-auto space-y-2">
              {libraryQuestions.length === 0 && !search ? (
                <p className="text-sm text-gray-500">Nhập từ khóa và nhấn Tìm, hoặc mở thư viện.</p>
              ) : (
                libraryQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-2 rounded border border-white/10 p-2"
                  >
                    <span className="line-clamp-1 text-sm text-gray-300">{q.content.slice(0, 80)}…</span>
                    {existingIds.has(q.id) ? (
                      <span className="text-xs text-gray-500">Đã thêm</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddQuestion(q.id)}
                        className="shrink-0 rounded bg-[#D4AF37] px-2 py-1 text-xs font-bold text-black"
                      >
                        Thêm
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setAddingMode(null);
                setLibraryQuestions([]);
                setSearch("");
              }}
              className="mt-4 text-sm text-gray-400 hover:text-white"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
