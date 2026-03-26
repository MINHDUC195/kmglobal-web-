"use client";

import { useState } from "react";
import type { QuizSubmitResult } from "./QuizMultipleChoice";
import { computeQuizAnswerRevealState } from "../lib/quiz-answer-reveal";

export type Option = {
  id: string;
  option_text: string;
};

function optionIdMatchingDisplay(options: Option[], display: string): string | null {
  const normalized = display.trim();
  if (!normalized) return null;
  const found = options.find((o) => o.option_text.trim() === normalized);
  return found?.id ?? null;
}

type QuizSingleChoiceProps = {
  questionId: string;
  content: string;
  options: Option[];
  onSubmit: (questionId: string, selectedOptionIds: string[]) => Promise<QuizSubmitResult>;
  disabled?: boolean;
  variant?: "light" | "dark";
  questionLabel?: string;
  maxPoints?: number;
  attemptsUsed?: number;
  maxAttempts?: number;
  initialCorrect?: boolean;
  initialPointsEarned?: number;
  initialStudentAnswerDisplay?: string;
  initialCorrectAnswerDisplay?: string;
};

export default function QuizSingleChoice({
  questionId,
  content,
  options,
  onSubmit,
  disabled = false,
  variant = "dark",
  questionLabel,
  maxPoints = 1,
  attemptsUsed: initialAttemptsUsed = 0,
  maxAttempts = 3,
  initialCorrect = false,
  initialPointsEarned = 0,
  initialStudentAnswerDisplay,
  initialCorrectAnswerDisplay,
}: QuizSingleChoiceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [result, setResult] = useState<QuizSubmitResult | null>(
    initialCorrect ? { isCorrect: true, pointsEarned: initialPointsEarned } : null
  );
  const [attemptsUsed, setAttemptsUsed] = useState(initialAttemptsUsed);
  const [submitting, setSubmitting] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const isLight = variant === "light";
  const {
    fullCreditFromServer,
    noMoreAttempts,
    locked,
    canShowRevealButton,
    showAnswerDetails,
  } = computeQuizAnswerRevealState({
    result,
    revealed,
    maxPoints,
    initialCorrect,
    initialPointsEarned,
    initialAttemptsUsed,
    maxAttempts,
    initialStudentAnswerDisplay,
    initialCorrectAnswerDisplay,
  });

  const canRetry =
    result &&
    !result.isCorrect &&
    !result.outOfAttempts &&
    attemptsUsed < maxAttempts;

  const displayPoints = result
    ? result.pointsEarned
    : Math.min(initialPointsEarned, maxPoints);
  const displayAttempts = result || initialCorrect ? attemptsUsed : initialAttemptsUsed;
  const showSubmitButton = !result && !fullCreditFromServer && !noMoreAttempts;

  const formCls = isLight
    ? "rounded-xl border border-gray-200 bg-gray-50 p-4"
    : "rounded-xl border border-white/10 bg-white/5 p-4";
  const contentCls = isLight ? "mb-4 text-gray-900" : "mb-4 text-white";
  const optBase = isLight
    ? "border-gray-200 hover:border-gray-300"
    : "border-white/10 hover:border-white/20";
  const optSelected = "border-[#D4AF37] bg-[#D4AF37]/10";
  const optTextCls = isLight ? "text-gray-700" : "text-gray-200";
  const resultCorrectCls = isLight ? "text-emerald-600" : "text-emerald-400";
  const resultWrongCls = isLight ? "text-amber-600" : "text-amber-400";
  const studentDisplay =
    result?.studentAnswerDisplay ?? (revealed ? initialStudentAnswerDisplay : undefined);
  const correctDisplay =
    result?.correctAnswerDisplay ?? (revealed ? initialCorrectAnswerDisplay : undefined);
  const studentSelectedId = studentDisplay ? optionIdMatchingDisplay(options, studentDisplay) : null;
  const correctOptionId = correctDisplay ? optionIdMatchingDisplay(options, correctDisplay) : null;

  function handleRetry() {
    setResult(null);
    setSelectedId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId || submitting || disabled) return;
    setSubmitting(true);
    try {
      const res = await onSubmit(questionId, [selectedId]);
      setResult(res);
      setAttemptsUsed((c) => c + 1);
      if (res.correctAnswerDisplay) setRevealed(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={formCls}>
      {(questionLabel || maxAttempts > 0) && (
        <p className={`mb-2 text-xs ${isLight ? "text-gray-500" : "text-gray-400"}`}>
          {questionLabel && <span className="font-medium">{questionLabel}</span>}
          {questionLabel && maxPoints > 0 && " · "}
          {maxPoints > 0 && (
            <span>
              {displayPoints}/{maxPoints} điểm
            </span>
          )}
          {maxAttempts > 0 && (
            <>
              {(questionLabel || maxPoints > 0) && " · "}
              <span>{displayAttempts}/{maxAttempts} lượt</span>
            </>
          )}
        </p>
      )}
      <p className={contentCls}>{content}</p>
      <div className="space-y-2">
        {options.map((opt) => {
          const isUserSelected =
            result || locked ? studentSelectedId === opt.id || selectedId === opt.id : selectedId === opt.id;
          const isCorrectOption = showAnswerDetails && correctOptionId === opt.id;
          const optHighlight =
            showAnswerDetails && isCorrectOption
              ? "border-amber-400 bg-amber-50"
              : isUserSelected
                ? optSelected
                : optBase;
          return (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                optHighlight
              } ${result || locked ? "pointer-events-none opacity-70" : ""}`}
            >
              <input
                type="radio"
                name={`q-${questionId}`}
                value={opt.id}
                checked={isUserSelected}
                onChange={() => !locked && setSelectedId(opt.id)}
                disabled={!!result || locked || disabled}
                className="h-4 w-4 accent-[#D4AF37]"
              />
              {showAnswerDetails && (
                <span
                  className={`text-xs font-bold ${
                    isUserSelected
                      ? isCorrectOption
                        ? "text-black"
                        : "text-red-600"
                      : "text-transparent"
                  }`}
                  title={isUserSelected ? "Đáp án học viên đã chọn" : undefined}
                >
                  {isUserSelected ? (isCorrectOption ? "✓" : "✕") : "✓"}
                </span>
              )}
              <span className={optTextCls}>{opt.option_text}</span>
              {isCorrectOption && (
                <span className="ml-auto font-semibold text-emerald-600" title="Đáp án đúng">
                  ✓
                </span>
              )}
            </label>
          );
        })}
      </div>
      {showSubmitButton && (
        <button
          type="submit"
          disabled={!selectedId || submitting || disabled}
          className="mt-4 rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-50"
        >
          {submitting ? "Đang chấm..." : "Gửi đáp án"}
        </button>
      )}

      {(result || locked) && (
        <div className="mt-4 space-y-2">
          {result && (
            <p
              className={`text-sm font-medium ${
                result.isCorrect ? resultCorrectCls : resultWrongCls
              }`}
            >
              {result.isCorrect
                ? `Đúng! +${result.pointsEarned} điểm`
                : result.outOfAttempts
                  ? "Đã hết lượt thử."
                  : "Sai. Bạn có thể thử lại."}
            </p>
          )}
          {!result && locked && (
            <p
              className={`text-sm font-medium ${
                fullCreditFromServer ? resultCorrectCls : resultWrongCls
              }`}
            >
              {fullCreditFromServer
                ? `Đạt ${initialPointsEarned}/${maxPoints} điểm (đủ tối đa).`
                : `Đạt ${initialPointsEarned}/${maxPoints} điểm. Đã hết lượt làm.`}
            </p>
          )}

          {showAnswerDetails && (
            <div className={`text-sm ${isLight ? "text-gray-600" : "text-gray-300"}`}>
              {(result?.studentAnswerDisplay ??
                (revealed ? initialStudentAnswerDisplay : undefined)) && (
                <p>
                  <span className="font-medium">Đáp án của bạn:</span>{" "}
                  {result?.studentAnswerDisplay ?? initialStudentAnswerDisplay}
                </p>
              )}
              {(result?.correctAnswerDisplay ??
                (revealed ? initialCorrectAnswerDisplay : undefined)) && (
                <p>
                  <span className="font-medium">Đáp án đúng:</span>{" "}
                  {result?.correctAnswerDisplay ?? initialCorrectAnswerDisplay}
                </p>
              )}
            </div>
          )}

          {canShowRevealButton && (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="mt-2 rounded-full border border-[#D4AF37] px-4 py-1.5 text-sm font-medium text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              Hiện đáp án
            </button>
          )}

          {canRetry && (
            <button
              type="button"
              onClick={handleRetry}
              className="mt-2 rounded-full border border-[#D4AF37] px-4 py-1.5 text-sm font-medium text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              Thử lại
            </button>
          )}
        </div>
      )}
    </form>
  );
}
