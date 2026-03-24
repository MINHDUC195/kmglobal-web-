"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";

type Question = {
  id: string;
  code?: string | null;
  content: string;
  type: string;
  points: number;
  max_attempts: number;
  tags: string[];
  program_id?: string | null;
  difficulty_level?: string | null;
  created_at: string;
};

type Program = { id: string; name: string; code?: string | null };

type Props = {
  initialQuestions: Question[];
  programs: Program[];
  difficultyOptions: { value: string; label: string }[];
  selectedProgramId: string;
  selectedDifficulty: string;
};

const TYPE_LABELS: Record<string, string> = {
  single_choice: "1 đáp án",
  multiple_choice: "Nhiều đáp án",
  fill_blank: "Điền ô trống",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  "dễ": "Dễ",
  "trung bình": "Trung bình",
  "khó": "Khó",
};

export default function QuestionLibraryClient({
  initialQuestions,
  programs,
  difficultyOptions,
  selectedProgramId,
  selectedDifficulty,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/admin/question-library?${params.toString()}`);
  }

  function getProgramName(id: string | null | undefined) {
    if (!id) return "-";
    return programs.find((p) => p.id === id)?.name ?? "-";
  }

  async function handleDelete(qId: string, content: string) {
    if (!confirm(`Xóa câu hỏi: "${content.slice(0, 50)}..."?\n\nHành động này không thể hoàn tác.`)) return;
    setDeletingId(qId);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("questions").delete().eq("id", qId);
      if (!error) router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <span className="text-sm font-medium text-white/90">Lọc theo:</span>
        <select
          value={selectedProgramId}
          onChange={(e) => applyFilter("programId", e.target.value)}
          className="rounded-lg border border-white/15 bg-[#0b1323] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]"
        >
          <option value="">Tất cả chương trình</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={selectedDifficulty}
          onChange={(e) => applyFilter("difficulty", e.target.value)}
          className="rounded-lg border border-white/15 bg-[#0b1323] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]"
        >
          <option value="">Tất cả độ khó</option>
          {difficultyOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="w-24 px-4 py-3 font-semibold text-white">Mã</th>
              <th className="px-4 py-3 font-semibold text-white">Nội dung</th>
              <th className="px-4 py-3 font-semibold text-white">Loại</th>
              <th className="px-4 py-3 font-semibold text-white">Chương trình</th>
              <th className="px-4 py-3 font-semibold text-white">Độ khó</th>
              <th className="px-4 py-3 font-semibold text-white">Điểm</th>
              <th className="px-4 py-3 font-semibold text-white">Lần trả lời</th>
              <th className="px-4 py-3 font-semibold text-white">Tag</th>
              <th className="px-4 py-3 font-semibold text-white">Hành động</th>
            </tr>
          </thead>
        <tbody className="divide-y divide-white/5">
          {initialQuestions.length ? (
            initialQuestions.map((q) => (
              <tr key={q.id} className="text-gray-300">
                <td className="px-4 py-3 font-mono text-sm text-[#D4AF37]/90">
                  {q.code || "-"}
                </td>
                <td className="max-w-xs truncate px-4 py-3" title={q.content}>
                  {q.content}
                </td>
                <td className="px-4 py-3">{TYPE_LABELS[q.type] ?? q.type}</td>
                <td className="px-4 py-3">{getProgramName(q.program_id)}</td>
                <td className="px-4 py-3">{q.difficulty_level ? DIFFICULTY_LABELS[q.difficulty_level] ?? q.difficulty_level : "-"}</td>
                <td className="px-4 py-3">{q.points}</td>
                <td className="px-4 py-3">{q.max_attempts}</td>
                <td className="px-4 py-3">
                  {(q.tags ?? []).length ? (q.tags as string[]).join(", ") : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/question-library/${q.id}`}
                      className="font-medium text-[#D4AF37] hover:underline"
                    >
                      Sửa
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id, q.content)}
                      disabled={deletingId === q.id}
                      className="text-sm text-red-400 hover:underline disabled:opacity-50"
                    >
                      {deletingId === q.id ? "Đang xóa..." : "Xóa"}
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                Chưa có câu hỏi. Nhấn &quot;Thêm câu hỏi&quot; để tạo.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
