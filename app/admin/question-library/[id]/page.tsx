"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import DashboardNav from "../../../../components/DashboardNav";
import Footer from "../../../../components/Footer";
import { getSupabaseBrowserClient } from "../../../../lib/supabase-browser";

type OptionRow = { id: string; text: string; isCorrect: boolean };
type Program = { id: string; name: string; code?: string | null };

function EditQuestionContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId");
  const id = params.id as string;
  const supabase = getSupabaseBrowserClient();

  const [content, setContent] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"single_choice" | "multiple_choice" | "fill_blank">("single_choice");
  const [points, setPoints] = useState("1");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [tags, setTags] = useState("");
  const [programId, setProgramId] = useState<string>("");
  const [difficultyLevel, setDifficultyLevel] = useState<string>("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [fillBlankAnswer, setFillBlankAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("programs")
      .select("id, name, code")
      .order("name")
      .then(({ data }: { data: Program[] | null }) => setPrograms(data ?? []));
  }, [supabase]);

  useEffect(() => {
    async function load() {
      const { data: q, error: qErr } = await supabase
        .from("questions")
        .select("*")
        .eq("id", id)
        .single();

      if (qErr || !q) {
        setError("Không tìm thấy câu hỏi");
        return;
      }

      setContent(q.content ?? "");
      setCode((q.code as string) ?? "");
      setType((q.type as "single_choice" | "multiple_choice" | "fill_blank") ?? "single_choice");
      setPoints(String(q.points ?? 1));
      setMaxAttempts(q.max_attempts ?? 1);
      setTags((q.tags as string[] ?? []).join(", "));
      setProgramId((q.program_id as string) ?? "");
      setDifficultyLevel((q.difficulty_level as string) ?? "");

      const { data: opts } = await supabase
        .from("question_options")
        .select("id, option_text, is_correct")
        .eq("question_id", id)
        .order("sort_order");

      type OptRow = { id: string; option_text: string; is_correct: boolean | null };
      const optRows = (opts ?? []) as OptRow[];

      if (q.type === "fill_blank" && optRows.length) {
        setFillBlankAnswer(optRows.find((o) => o.is_correct)?.option_text ?? "");
      } else {
        setOptions(
          optRows.map((o) => ({
            id: o.id,
            text: o.option_text,
            isCorrect: Boolean(o.is_correct),
          }))
        );
      }
    }
    void load().finally(() => setLoading(false));
  }, [id, supabase]);

  function addOption() {
    setOptions((prev) => [...prev, { id: crypto.randomUUID(), text: "", isCorrect: false }]);
  }

  function removeOption(optId: string) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((o) => o.id !== optId));
  }

  function updateOption(optId: string, field: "text" | "isCorrect", value: string | boolean) {
    setOptions((prev) => {
      if (field === "isCorrect" && value === true && type === "single_choice") {
        return prev.map((o) => ({ ...o, isCorrect: o.id === optId }));
      }
      return prev.map((o) => (o.id === optId ? { ...o, [field]: value } : o));
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await supabase
        .from("questions")
        .update({
          content: content.trim(),
          code: code.trim() || null,
          type,
          points: parseFloat(points) || 1,
          max_attempts: maxAttempts,
          tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          program_id: programId.trim() || null,
          difficulty_level: difficultyLevel.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      await supabase.from("question_options").delete().eq("question_id", id);

      if (type === "fill_blank") {
        await supabase.from("question_options").insert({
          question_id: id,
          option_text: fillBlankAnswer.trim(),
          sort_order: 0,
          is_correct: true,
        });
      } else {
        const opts = options.filter((o) => o.text.trim());
        if (!opts.some((o) => o.isCorrect)) throw new Error("Chọn ít nhất một đáp án đúng");
        await supabase.from("question_options").insert(
          opts.map((o, i) => ({
            question_id: id,
            option_text: o.text.trim(),
            sort_order: i,
            is_correct: o.isCorrect,
          }))
        );
      }

      router.push(lessonId ? `/admin/lessons/${lessonId}` : "/admin/question-library");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Admin" />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-gray-400">Đang tải...</p>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Admin" />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-red-400">{error}</p>
          <Link
            href={lessonId ? `/admin/lessons/${lessonId}` : "/admin/question-library"}
            className="mt-4 inline-block text-[#D4AF37] hover:underline"
          >
            ← {lessonId ? "Về soạn thảo bài học" : "Về thư viện"}
          </Link>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Admin" />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <Link
          href={lessonId ? `/admin/lessons/${lessonId}` : "/admin/question-library"}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[#D4AF37] hover:underline"
        >
          ← {lessonId ? "Về soạn thảo bài học" : "Quay về thư viện câu hỏi"}
        </Link>
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Chỉnh sửa câu hỏi
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 max-w-2xl space-y-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Mã thứ tự</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VD: Q001, CH1-01 (tùy chọn)"
              className="w-full max-w-[200px] rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Nội dung câu hỏi *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              rows={3}
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Loại câu hỏi</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "single_choice" | "multiple_choice" | "fill_blank")}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            >
              <option value="single_choice">Trắc nghiệm 1 đáp án</option>
              <option value="multiple_choice">Trắc nghiệm nhiều đáp án</option>
              <option value="fill_blank">Điền vào ô trống</option>
            </select>
          </div>

          <div className="flex gap-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Điểm</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="w-24 rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Số lần trả lời</label>
              <select
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                className="rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              >
                <option value={1}>1 lần</option>
                <option value={2}>2 lần</option>
                <option value={3}>3 lần</option>
              </select>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-white/90">Chương trình</label>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              >
                <option value="">-- Chọn chương trình --</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-white/90">Độ khó</label>
              <select
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              >
                <option value="">-- Chọn độ khó --</option>
                <option value="dễ">Dễ</option>
                <option value="trung bình">Trung bình</option>
                <option value="khó">Khó</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="VD: ISO9001, chương 1"
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            />
          </div>

          {type === "fill_blank" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Đáp án đúng</label>
              <input
                type="text"
                value={fillBlankAnswer}
                onChange={(e) => setFillBlankAnswer(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
                required
              />
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-medium text-white/90">Đáp án</label>
              <div className="space-y-2">
                {options.map((opt) => (
                  <div key={opt.id} className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={opt.isCorrect}
                      onChange={(e) => updateOption(opt.id, "isCorrect", e.target.checked)}
                      className="mt-3 h-4 w-4 accent-[#D4AF37]"
                    />
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => updateOption(opt.id, "text", e.target.value)}
                      placeholder="Nội dung đáp án"
                      className="flex-1 rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(opt.id)}
                      className="rounded-lg px-3 text-red-400 hover:bg-red-500/10"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addOption} className="text-sm text-[#D4AF37] hover:underline">
                  + Thêm đáp án
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
            <Link
              href={lessonId ? `/admin/lessons/${lessonId}` : "/admin/question-library"}
              className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
            >
              Hủy
            </Link>
          </div>
        </form>

        <Link
          href={lessonId ? `/admin/lessons/${lessonId}` : "/admin/question-library"}
          className="mt-6 inline-block text-sm text-[#D4AF37] hover:underline"
        >
          ← {lessonId ? "Về soạn thảo bài học" : "Về thư viện câu hỏi"}
        </Link>
      </main>

      <Footer hideLogo />
    </div>
  );
}

export default function EditQuestionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a1628] px-6 py-12 text-center text-gray-400">
          Đang tải...
        </div>
      }
    >
      <EditQuestionContent />
    </Suspense>
  );
}
