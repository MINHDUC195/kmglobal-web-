"use client";

import { useEffect, useMemo, useState } from "react";
import { computeQuizAnswerRevealState } from "../lib/quiz-answer-reveal";

/**
 * Match options against display string. Display format: "text1, text2, text3"
 * Option texts may contain ", " - so we match each option_text as complete segment.
 * Sort by text length descending to match longer options first (avoid "A" matching inside "A, B").
 */
function optionIdsMatchingDisplay(options: Option[], display: string): Set<string> {
  const ids = new Set<string>();
  const sorted = [...options].sort(
    (a, b) => (b.option_text?.length ?? 0) - (a.option_text?.length ?? 0)
  );
  for (const opt of sorted) {
    const text = opt.option_text?.trim() ?? "";
    if (!text) continue;
    const idx = display.indexOf(text);
    if (idx === -1) continue;
    const beforeOk = idx === 0 || display.slice(idx - 2, idx) === ", ";
    const afterEnd = idx + text.length;
    const afterOk = afterEnd >= display.length || display.slice(afterEnd, afterEnd + 2) === ", ";
    if (beforeOk && afterOk) ids.add(opt.id);
  }
  return ids;
}

export type Option = {
  id: string;
  option_text: string;
};

export type QuizSubmitResult = {
  isCorrect: boolean;
  pointsEarned: number;
  outOfAttempts?: boolean;
  studentAnswerDisplay?: string;
  correctAnswerDisplay?: string;
  maxPoints?: number;
};

type QuizMultipleChoiceProps = {
  questionId: string;
  content: string;
  options: Option[];
  onSubmit: (questionId: string, selectedOptionIds: string[]) => Promise<QuizSubmitResult>;
  disabled?: boolean;
  variant?: "light" | "dark";
  /** e.g. "Câu 1.1.1" */
  questionLabel?: string;
  maxPoints?: number;
  attemptsUsed?: number;
  maxAttempts?: number;
  /** Đạt đủ điểm tối đa (từ API) */
  initialCorrect?: boolean;
  initialPointsEarned?: number;
  /** Chỉ có khi đã hết lượt hoặc đạt đủ điểm — dùng cho nút Hiện đáp án */
  initialStudentAnswerDisplay?: string;
  initialCorrectAnswerDisplay?: string;
};

export default function QuizMultipleChoice({
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
}: QuizMultipleChoiceProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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

  const studentDisplay =
    result?.studentAnswerDisplay ?? (revealed ? initialStudentAnswerDisplay : undefined);
  const correctDisplay =
    result?.correctAnswerDisplay ?? (revealed ? initialCorrectAnswerDisplay : undefined);

  const displaySelectedIds = useMemo(() => {
    if (result) return selectedIds;
    if (showAnswerDetails && studentDisplay) {
      return optionIdsMatchingDisplay(options, studentDisplay);
    }
    return selectedIds;
  }, [result, showAnswerDetails, studentDisplay, selectedIds, options]);

  const correctOptionIds = useMemo(() => {
    if (!showAnswerDetails || !correctDisplay) return new Set<string>();
    return optionIdsMatchingDisplay(options, correctDisplay);
  }, [showAnswerDetails, correctDisplay, options]);

  useEffect(() => {
    if (
      (result || initialCorrect) &&
      initialStudentAnswerDisplay &&
      options.length > 0 &&
      selectedIds.size === 0
    ) {
      const ids = optionIdsMatchingDisplay(options, initialStudentAnswerDisplay);
      if (ids.size > 0) setSelectedIds(ids);
    }
  }, [
    result,
    initialCorrect,
    initialStudentAnswerDisplay,
    options,
    selectedIds.size,
  ]);

  const canRetry =
    result &&
    !result.isCorrect &&
    !result.outOfAttempts &&
    attemptsUsed < maxAttempts;

  const formCls = isLight
    ? "rounded-xl border border-gray-200 bg-gray-50 p-4"
    : "rounded-xl border border-white/10 bg-white/5 p-4";
  const contentCls = isLight ? "mb-4 text-gray-900" : "mb-4 text-white";
  const hintCls = isLight ? "mb-2 text-xs text-gray-500" : "mb-2 text-xs text-gray-400";
  const optBase = isLight
    ? "border-gray-200 hover:border-gray-300"
    : "border-white/10 hover:border-white/20";
  const optSelected = "border-[#D4AF37] bg-[#D4AF37]/10";
  const optTextCls = isLight ? "text-gray-700" : "text-gray-200";
  const resultCorrectCls = isLight ? "text-emerald-600" : "text-emerald-400";
  const resultWrongCls = isLight ? "text-amber-600" : "text-amber-400";

  function toggleOption(id: string) {
    if (result || locked) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleRetry() {
    setResult(null);
    setSelectedIds(new Set());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedIds.size === 0 || submitting || disabled) return;
    setSubmitting(true);
    try {
      const res = await onSubmit(questionId, Array.from(selectedIds));
      setResult(res);
      setAttemptsUsed((c) => c + 1);
      if (res.correctAnswerDisplay) setRevealed(true);
    } finally {
      setSubmitting(false);
    }
  }

  const displayPoints = result
    ? result.pointsEarned
    : Math.min(initialPointsEarned, maxPoints);
  const displayAttempts = result || initialCorrect ? attemptsUsed : initialAttemptsUsed;

  const showSubmitButton = !result && !fullCreditFromServer && !noMoreAttempts;

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
      <p className={hintCls}>Chọn tất cả đáp án đúng</p>
      <div className="space-y-2">
        {options.map((opt) => {
          const isUserSelected = displaySelectedIds.has(opt.id);
          const isCorrectOption = correctOptionIds.has(opt.id);
          const optHighlight =
            showAnswerDetails && isCorrectOption
              ? "border-amber-400 bg-amber-50"
              : result || locked
                ? isUserSelected
                  ? isLight
                    ? "border-[#9FB3C8] bg-[#F0F4F8]"
                    : "border-white/20 bg-white/10"
                  : optBase
                : isUserSelected
                  ? optSelected
                  : optBase;
          return (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${optHighlight} ${
                result || locked ? "pointer-events-none opacity-70" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={isUserSelected}
                onChange={() => toggleOption(opt.id)}
                disabled={!!result || locked || disabled}
                className="h-4 w-4 accent-[#D4AF37]"
              />
              {showAnswerDetails && (
                <span
                  className={`text-xs font-bold ${
                    isUserSelected ? "text-black" : "text-transparent"
                  }`}
                  title={isUserSelected ? "Đáp án học viên đã chọn" : undefined}
                >
                  ✓
                </span>
              )}
              <span className={optTextCls}>{opt.option_text}</span>
              {showAnswerDetails && isCorrectOption && (
                <span
                  className={`ml-auto font-semibold ${isLight ? "text-emerald-600" : "text-emerald-400"}`}
                  title="Đáp án đúng"
                >
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
          disabled={selectedIds.size === 0 || submitting || disabled}
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
                  : result.pointsEarned > 0
                    ? `Đạt ${result.pointsEarned}/${maxPoints} điểm. Bạn có thể thử lại để đạt tối đa.`
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
