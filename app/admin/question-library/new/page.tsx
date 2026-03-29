"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { generateNextQuestionCode } from "../../../../lib/question-code";
import { HIDE_FROM_LIBRARY_TAG } from "../../../../lib/question-tags";
import { getSupabaseBrowserClient } from "../../../../lib/supabase-browser";

type OptionRow = { id: string; text: string; isCorrect: boolean };
type Program = { id: string; name: string; code?: string | null };

function NewQuestionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonId = searchParams.get("lessonId");
  const baseCourseId = searchParams.get("baseCourseId");
  const programIdParam = searchParams.get("programId");
  const fromFinalExam = searchParams.get("fromFinalExam") === "1";
  const supabase = getSupabaseBrowserClient();

  const [saveToLibrary, setSaveToLibrary] = useState(true);

  const [content, setContent] = useState("");
  const [type, setType] = useState<"single_choice" | "multiple_choice" | "fill_blank">("single_choice");
  const [points, setPoints] = useState("1");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [programId, setProgramId] = useState<string>("");
  const [difficultyLevel, setDifficultyLevel] = useState<string>("");
  const [programs, setPrograms] = useState<Program[]>([]);

  const [contextLoading, setContextLoading] = useState(false);
  const [contextLocked, setContextLocked] = useState(false);
  const [resolvedProgramName, setResolvedProgramName] = useState<string>("");
  const [resolvedProgramCode, setResolvedProgramCode] = useState<string>("");
  const [resolvedBaseCourseId, setResolvedBaseCourseId] = useState<string | null>(null);
  const [resolvedBaseCourseName, setResolvedBaseCourseName] = useState<string | null>(null);
  const [resolvedBaseCourseCode, setResolvedBaseCourseCode] = useState<string | null>(null);

  const [options, setOptions] = useState<OptionRow[]>([
    { id: "1", text: "", isCorrect: false },
    { id: "2", text: "", isCorrect: false },
  ]);
  const [fillBlankAnswer, setFillBlankAnswer] = useState("");
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
    if (!lessonId && !baseCourseId && !programIdParam) {
      setContextLocked(false);
      return;
    }

    let cancelled = false;

    async function resolveContext() {
      setContextLoading(true);
      setContextLocked(false);
      setResolvedBaseCourseId(null);
      setResolvedBaseCourseName(null);
      setResolvedBaseCourseCode(null);
      setResolvedProgramName("");
      setResolvedProgramCode("");

      try {
        if (lessonId) {
          const { data: lesson, error: le } = await supabase
            .from("lessons")
            .select("chapter_id")
            .eq("id", lessonId)
            .single();
          if (cancelled || le || !lesson?.chapter_id) return;

          const { data: chapter, error: ce } = await supabase
            .from("chapters")
            .select("base_course_id")
            .eq("id", lesson.chapter_id)
            .single();
          if (cancelled || ce || !chapter?.base_course_id) return;

          const { data: bc, error: be } = await supabase
            .from("base_courses")
            .select("id, code, name, program_id, program:programs(id, code, name)")
            .eq("id", chapter.base_course_id)
            .single();
          if (cancelled || be || !bc?.program_id) return;

          const prog = bc.program as { id?: string; code?: string | null; name?: string } | null;
          if (!prog?.id) return;

          setProgramId(prog.id);
          setResolvedProgramName(prog.name ?? "");
          setResolvedProgramCode(prog.code?.trim() || prog.name || "");
          setResolvedBaseCourseId(bc.id);
          setResolvedBaseCourseName(bc.name ?? null);
          setResolvedBaseCourseCode(bc.code ?? null);
          setContextLocked(true);
          return;
        }

        if (baseCourseId) {
          const { data: bc, error: be } = await supabase
            .from("base_courses")
            .select("id, code, name, program_id, program:programs(id, code, name)")
            .eq("id", baseCourseId)
            .single();
          if (cancelled || be || !bc?.program_id) return;

          const prog = bc.program as { id?: string; code?: string | null; name?: string } | null;
          if (!prog?.id) return;

          setProgramId(prog.id);
          setResolvedProgramName(prog.name ?? "");
          setResolvedProgramCode(prog.code?.trim() || prog.name || "");
          setResolvedBaseCourseId(bc.id);
          setResolvedBaseCourseName(bc.name ?? null);
          setResolvedBaseCourseCode(bc.code ?? null);
          setContextLocked(true);
          return;
        }

        if (programIdParam) {
          const { data: prog, error: pe } = await supabase
            .from("programs")
            .select("id, code, name")
            .eq("id", programIdParam)
            .single();
          if (cancelled || pe || !prog?.id) return;

          setProgramId(prog.id);
          setResolvedProgramName(prog.name ?? "");
          setResolvedProgramCode(prog.code?.trim() || prog.name || "");
          setResolvedBaseCourseId(null);
          setResolvedBaseCourseName(null);
          setResolvedBaseCourseCode(null);
          setContextLocked(true);
        }
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    }

    void resolveContext();
    return () => {
      cancelled = true;
    };
  }, [lessonId, baseCourseId, programIdParam, supabase]);

  function addOption() {
    setOptions((prev) => [...prev, { id: crypto.randomUUID(), text: "", isCorrect: false }]);
  }

  function removeOption(id: string) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((o) => o.id !== id));
  }

  function updateOption(id: string, field: "text" | "isCorrect", value: string | boolean) {
    setOptions((prev) => {
      if (field === "isCorrect" && value === true && type === "single_choice") {
        return prev.map((o) => ({
          ...o,
          [field]: o.id === id ? value : false,
        }));
      }
      return prev.map((o) => (o.id === id ? { ...o, [field]: value } : o));
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const pid = programId.trim();
      if (!pid) {
        throw new Error("Chọn chương trình hoặc mở trang từ bài học / khóa học / chương trình.");
      }

      const manualTags: string[] = [];
      if (fromFinalExam && !lessonId && !saveToLibrary) {
        manualTags.push(HIDE_FROM_LIBRARY_TAG);
      }

      let programCodeForGen = resolvedProgramCode.trim();
      if (!programCodeForGen) {
        const pRow = programs.find((p) => p.id === pid);
        programCodeForGen = pRow?.code?.trim() || pRow?.name || "P";
      }

      const baseCoursePart =
        contextLocked && resolvedBaseCourseCode?.trim() ? resolvedBaseCourseCode.trim() : null;

      const autoCode = await generateNextQuestionCode(
        supabase,
        pid,
        programCodeForGen,
        baseCoursePart ?? null
      );

      const { data: question, error: qErr } = await supabase
        .from("questions")
        .insert({
          content: content.trim(),
          code: autoCode,
          type,
          points: parseFloat(points) || 1,
          max_attempts: maxAttempts,
          tags: manualTags,
          lesson_id: lessonId || null,
          program_id: pid,
          difficulty_level: difficultyLevel.trim() || null,
        })
        .select()
        .single();

      if (qErr) throw new Error(qErr.message);

      if (type === "fill_blank") {
        await supabase.from("question_options").insert({
          question_id: question.id,
          option_text: fillBlankAnswer.trim(),
          sort_order: 0,
          is_correct: true,
        });
      } else {
        const opts = options.filter((o) => o.text.trim());
        if (!opts.some((o) => o.isCorrect)) {
          throw new Error("Chọn ít nhất một đáp án đúng");
        }
        await supabase.from("question_options").insert(
          opts.map((o, i) => ({
            question_id: question.id,
            option_text: o.text.trim(),
            sort_order: i,
            is_correct: o.isCorrect,
          }))
        );
      }

      if (fromFinalExam && baseCourseId && !lessonId) {
        const attach = await fetch("/api/admin/final-exam/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseCourseId, questionId: question.id }),
        });
        const attachJson = await attach.json();
        if (!attach.ok) {
          throw new Error(
            attachJson.error ||
              "Đã lưu câu hỏi nhưng chưa gắn được vào bài thi cuối. Hãy thêm thủ công từ thư viện."
          );
        }
        router.push(`/admin/base-courses/${baseCourseId}/final-exam`);
        router.refresh();
        return;
      }

      router.push(lessonId ? `/admin/lessons/${lessonId}` : "/admin/question-library");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi");
    } finally {
      setSubmitting(false);
    }
  }

  const showContextLoader = Boolean(lessonId || baseCourseId || programIdParam);

  const sep = <span className="mx-1.5 text-gray-600" aria-hidden="true">›</span>;

  return (
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <nav aria-label="Đường dẫn quản trị" className="mb-6 flex flex-wrap items-center gap-y-1 text-sm">
          {!showContextLoader && (
            <>
              <Link
                href="/admin/question-library"
                className="font-medium text-[#D4AF37] hover:underline"
              >
                Thư viện câu hỏi
              </Link>
              {sep}
            </>
          )}
          {showContextLoader && (
            <>
              <Link href="/admin/programs" className="font-medium text-[#D4AF37] hover:underline">
                Chương trình
              </Link>
              {sep}
            </>
          )}
          {showContextLoader && contextLoading && (
            <>
              <span className="text-gray-500">Đang tải…</span>
              {sep}
            </>
          )}
          {showContextLoader && contextLocked && !contextLoading && programId && (
            <>
              <Link
                href={`/admin/programs/${programId}`}
                className="max-w-[min(100%,12rem)] truncate font-medium text-[#D4AF37] hover:underline sm:max-w-xs"
                title={resolvedProgramName}
              >
                {resolvedProgramName || "Chương trình"}
              </Link>
              {resolvedBaseCourseId ? (
                <>
                  {sep}
                  <Link
                    href={`/admin/base-courses/${resolvedBaseCourseId}`}
                    className="max-w-[min(100%,14rem)] truncate font-medium text-[#D4AF37] hover:underline sm:max-w-md"
                    title={resolvedBaseCourseName ?? undefined}
                  >
                    {resolvedBaseCourseName || "Khóa học cơ bản"}
                  </Link>
                </>
              ) : null}
              {fromFinalExam && baseCourseId ? (
                <>
                  {sep}
                  <Link
                    href={`/admin/base-courses/${baseCourseId}/final-exam`}
                    className="font-medium text-[#D4AF37] hover:underline"
                  >
                    Bài thi cuối khóa
                  </Link>
                </>
              ) : null}
              {lessonId && resolvedBaseCourseId ? (
                <>
                  {sep}
                  <Link
                    href={`/admin/lessons/${lessonId}`}
                    className="font-medium text-[#D4AF37] hover:underline"
                  >
                    Soạn bài học
                  </Link>
                </>
              ) : null}
              {sep}
            </>
          )}
          <span className="font-semibold text-white">Thêm câu hỏi</span>
        </nav>
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Thêm câu hỏi
        </h1>
        {lessonId && (
          <p className="mt-1 text-sm text-amber-400/90">
            Câu hỏi sẽ được gắn vào bài học hiện tại
          </p>
        )}
        {fromFinalExam && baseCourseId && !lessonId && (
          <div className="mt-3 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-sm text-gray-200">
            <p>
              Soạn câu cho <strong className="text-[#D4AF37]">bài thi cuối khóa</strong>. Sau khi lưu, câu sẽ được
              gắn vào bài thi tự động.
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={saveToLibrary}
                onChange={(e) => setSaveToLibrary(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[#D4AF37]"
              />
              <span>
                <strong className="text-white">Lưu vào thư viện câu hỏi</strong> — hiển thị khi tìm kiếm &quot;Thêm
                từ thư viện&quot; để tái sử dụng. Bỏ chọn nếu chỉ muốn câu dùng riêng cho bài thi này (vẫn lưu trong hệ
                thống).
              </span>
            </label>
          </div>
        )}

        {showContextLoader && contextLoading && (
          <p className="mt-4 text-sm text-gray-400">Đang tải chương trình / khóa học…</p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 max-w-2xl space-y-6">
          {contextLocked && !contextLoading && (resolvedProgramCode?.trim() || resolvedBaseCourseCode?.trim()) && (
            <div className="rounded-xl border border-[#D4AF37]/25 bg-[#0b1323] px-4 py-3">
              <p className="font-mono text-sm text-[#D4AF37]">
                {resolvedProgramCode?.trim() || "—"}
                {resolvedBaseCourseCode?.trim()
                  ? ` · ${resolvedBaseCourseCode.trim()}`
                  : programIdParam && !resolvedBaseCourseCode?.trim()
                    ? " · Q"
                    : ""}
              </p>
            </div>
          )}

          {!contextLocked && !contextLoading && (
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Chương trình *</label>
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                required
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
          )}

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

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Độ khó</label>
            <select
              value={difficultyLevel}
              onChange={(e) => setDifficultyLevel(e.target.value)}
              className="w-full max-w-md rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            >
              <option value="">-- Chọn độ khó --</option>
              <option value="dễ">Dễ</option>
              <option value="trung bình">Trung bình</option>
              <option value="khó">Khó</option>
            </select>
          </div>

          {type === "fill_blank" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">
                Đáp án đúng (lưu server, không gửi frontend)
              </label>
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
                      title="Đáp án đúng"
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
                <button
                  type="button"
                  onClick={addOption}
                  className="text-sm text-[#D4AF37] hover:underline"
                >
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
              disabled={submitting || (showContextLoader && contextLoading)}
              className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : "Thêm câu hỏi"}
            </button>
            <Link
              href={
                lessonId
                  ? `/admin/lessons/${lessonId}`
                  : fromFinalExam && baseCourseId
                    ? `/admin/base-courses/${baseCourseId}/final-exam`
                    : "/admin/question-library"
              }
              className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
            >
              Hủy
            </Link>
          </div>
        </form>
      </main>
  );
}

export default function NewQuestionPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 py-12 text-center text-gray-400">
          Đang tải...
        </div>
      }
    >
      <NewQuestionContent />
    </Suspense>
  );
}
