"use client";

import Link from "next/link";
import { FormEvent, useEffect, useCallback, useState } from "react";
import {
  AdminBreadcrumbStrip,
  type AdminBreadcrumbItem,
} from "../../../../components/AdminHierarchyBreadcrumb";
import DashboardNav from "../../../../components/DashboardNav";
import Footer from "../../../../components/Footer";

type QuizQuestion = {
  id: string;
  content: string;
  type: "single_choice" | "multiple_choice" | "fill_blank";
  points: number;
  options: { id: string; option_text: string }[];
};

type Answer = {
  questionId: string;
  selectedOptionIds?: string[];
  fillBlankAnswer?: string;
};

type FinalExamClientProps = {
  enrollmentId: string;
  finalExamId: string;
  examName: string;
  courseName: string;
  breadcrumbItems?: AdminBreadcrumbItem[];
};

export default function FinalExamClient({
  enrollmentId,
  finalExamId,
  examName,
  courseName,
  breadcrumbItems,
}: FinalExamClientProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Map<string, Answer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    passed: boolean;
    passThreshold: number;
    percentScore: number;
    overallPercent: number;
    totalPoints: number;
    maxPoints: number;
    certificate?: { id: string; code: string; percentScore: number };
    certificateBlockedReason?: string | null;
  } | null>(null);

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const res = await fetch(
          `/api/quiz/questions?finalExamId=${finalExamId}&enrollmentId=${enrollmentId}`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Không thể tải câu hỏi");
          return;
        }
        const { questions: qs } = await res.json();
        setQuestions(qs ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi tải nội dung");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [finalExamId, enrollmentId]);

  const setAnswer = useCallback((questionId: string, answer: Partial<Answer>) => {
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(questionId, { ...next.get(questionId), questionId, ...answer });
      return next;
    });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (questions.length === 0 || submitting) return;

    const unanswered = questions.filter((q) => {
      const a = answers.get(q.id);
      if (q.type === "fill_blank") return !a?.fillBlankAnswer?.trim();
      return !a?.selectedOptionIds?.length;
    });

    if (unanswered.length > 0) {
      setError(`Bạn chưa trả lời ${unanswered.length} câu hỏi. Vui lòng hoàn thành tất cả.`);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const answersArr = questions.map((q) => {
        const a = answers.get(q.id)!;
        if (q.type === "fill_blank") {
          return { questionId: q.id, fillBlankAnswer: a.fillBlankAnswer };
        }
        return { questionId: q.id, selectedOptionIds: a.selectedOptionIds ?? [] };
      });

      const res = await fetch("/api/quiz/final-exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          finalExamId,
          answers: answersArr,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Không thể nộp bài");
        return;
      }

      setResult({
        passed: data.passed,
        passThreshold: typeof data.passThreshold === "number" ? data.passThreshold : 70,
        percentScore: data.percentScore,
        overallPercent: typeof data.overallPercent === "number" ? data.overallPercent : data.percentScore,
        totalPoints: data.totalPoints,
        maxPoints: data.maxPoints,
        certificate: data.certificate ?? undefined,
        certificateBlockedReason: data.certificateBlockedReason ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi nộp bài");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Học viên" />
        {breadcrumbItems?.length ? <AdminBreadcrumbStrip items={breadcrumbItems} /> : null}
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-gray-400">Đang tải bài thi...</p>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Học viên" />
        {breadcrumbItems?.length ? <AdminBreadcrumbStrip items={breadcrumbItems} /> : null}
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-xl rounded-2xl border border-[#D4AF37]/30 bg-[#111c31]/90 p-8">
            <h1
              className={`font-[family-name:var(--font-serif)] text-2xl font-bold ${
                result.passed ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {result.passed ? "Chúc mừng! Bạn đã đạt yêu cầu" : "Chưa đạt yêu cầu"}
            </h1>
            <p className="mt-4 text-gray-300">
              Điểm bài thi cuối: <strong className="text-white">{result.totalPoints}</strong>/
              {result.maxPoints} (<strong className="text-white">{result.percentScore}%</strong>)
            </p>
            <p className="mt-2 text-gray-300">
              Điểm tổng khóa học (quá trình + thi cuối theo trọng số):{" "}
              <strong className="text-white">{result.overallPercent}%</strong>
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Để nhận chứng chỉ: điểm tổng khóa học phải đạt ≥ {result.passThreshold}% (theo cấu hình khóa).
            </p>

            {result.passed && result.certificateBlockedReason && (
              <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                <p className="font-semibold text-amber-200">Chưa cấp chứng chỉ</p>
                <p className="mt-1 text-amber-100/90">{result.certificateBlockedReason}</p>
              </div>
            )}

            {result.certificate && (
              <div className="mt-6 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 p-4">
                <p className="font-semibold text-[#D4AF37]">Mã chứng chỉ của bạn</p>
                <p className="mt-2 font-mono text-lg font-bold text-white">
                  {result.certificate.code}
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Lưu mã này để tra cứu tại trang Xác minh chứng chỉ.
                </p>
                <Link
                  href={`/verify?code=${encodeURIComponent(result.certificate.code)}`}
                  className="mt-4 inline-block rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
                >
                  Xem chứng chỉ
                </Link>
                <Link
                  href={`/api/student/certificates/${result.certificate.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-3 mt-4 inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
                >
                  Tải PDF chứng chỉ
                </Link>
              </div>
            )}

            <div className="mt-8 flex gap-4">
              <Link
                href={`/learn/${enrollmentId}`}
                className="rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                Về khóa học
              </Link>
              <Link
                href="/student"
                className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  if (error && questions.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Học viên" />
        {breadcrumbItems?.length ? <AdminBreadcrumbStrip items={breadcrumbItems} /> : null}
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-red-400">{error}</p>
          <Link
            href={`/learn/${enrollmentId}`}
            className="mt-6 inline-block text-[#D4AF37] hover:underline"
          >
            ← Về khóa học
          </Link>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Học viên" />
      {breadcrumbItems?.length ? <AdminBreadcrumbStrip items={breadcrumbItems} /> : null}
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <h1 className="mt-6 font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          {examName}
        </h1>
        <p className="mt-2 text-gray-400">{courseName}</p>

        {questions.length === 0 ? (
          <p className="mt-8 text-amber-400">Bài thi chưa có câu hỏi. Vui lòng liên hệ quản trị.</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-8">
            {error && (
              <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}

            <p className="text-sm text-gray-400">
              Trả lời tất cả {questions.length} câu hỏi sau đó nhấn nút Nộp bài.
            </p>

            <div className="space-y-6">
              {questions.map((q, idx) => {
                if (q.type === "single_choice") {
                  return (
                    <div key={q.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-4 font-medium text-white">
                        Câu {idx + 1}: {q.content}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt) => (
                          <label
                            key={opt.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                              answers.get(q.id)?.selectedOptionIds?.[0] === opt.id
                                ? "border-[#D4AF37] bg-[#D4AF37]/10"
                                : "border-white/10 hover:border-white/20"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              value={opt.id}
                              checked={answers.get(q.id)?.selectedOptionIds?.[0] === opt.id}
                              onChange={() =>
                                setAnswer(q.id, { selectedOptionIds: [opt.id] })
                              }
                              className="h-4 w-4 accent-[#D4AF37]"
                            />
                            <span className="text-gray-200">{opt.option_text}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }
                if (q.type === "multiple_choice") {
                  return (
                    <div key={q.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-4 font-medium text-white">
                        Câu {idx + 1}: {q.content}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt) => {
                          const selected = answers.get(q.id)?.selectedOptionIds ?? [];
                          const checked = selected.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                                checked ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-white/10 hover:border-white/20"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? selected.filter((id) => id !== opt.id)
                                    : [...selected, opt.id];
                                  setAnswer(q.id, { selectedOptionIds: next });
                                }}
                                className="h-4 w-4 accent-[#D4AF37]"
                              />
                              <span className="text-gray-200">{opt.option_text}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={q.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="mb-4 font-medium text-white">
                      Câu {idx + 1}: {q.content}
                    </p>
                    <input
                      type="text"
                      value={answers.get(q.id)?.fillBlankAnswer ?? ""}
                      onChange={(e) =>
                        setAnswer(q.id, { fillBlankAnswer: e.target.value })
                      }
                      className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
                      placeholder="Nhập đáp án..."
                    />
                  </div>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-10 w-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-6 py-4 text-base font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all hover:scale-[1.01] disabled:opacity-60"
            >
              {submitting ? "Đang chấm bài..." : "Nộp bài thi"}
            </button>
          </form>
        )}
      </main>
      <Footer hideLogo />
    </div>
  );
}
