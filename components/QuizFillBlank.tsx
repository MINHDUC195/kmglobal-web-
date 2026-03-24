"use client";

import { useState } from "react";
import type { QuizSubmitResult } from "./QuizMultipleChoice";
import { computeQuizAnswerRevealState } from "../lib/quiz-answer-reveal";

type QuizFillBlankProps = {
  questionId: string;
  content: string;
  onSubmit: (questionId: string, answer: string) => Promise<QuizSubmitResult>;
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

export default function QuizFillBlank({
  questionId,
  content,
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
}: QuizFillBlankProps) {
  const [answer, setAnswer] = useState("");
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
  const inputCls = isLight
    ? "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none focus:border-[#D4AF37] placeholder:text-gray-500"
    : "w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37] placeholder:text-gray-400";
  const resultCorrectCls = isLight ? "text-emerald-600" : "text-emerald-400";
  const resultWrongCls = isLight ? "text-amber-600" : "text-amber-400";

  function handleRetry() {
    setResult(null);
    setAnswer("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim() || submitting || disabled) return;
    setSubmitting(true);
    try {
      const res = await onSubmit(questionId, answer.trim());
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
      <input
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Nhập đáp án..."
        disabled={!!result || locked || disabled}
        className={inputCls}
      />
      {showSubmitButton && (
        <button
          type="submit"
          disabled={!answer.trim() || submitting || disabled}
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
