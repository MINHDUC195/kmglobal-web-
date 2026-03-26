/** So sánh điểm tối đa (tránh lỗi float) */
const QUIZ_SCORE_EPS = 1e-6;

type QuizRevealResult = {
  isCorrect?: boolean;
  studentAnswerDisplay?: string;
  correctAnswerDisplay?: string;
};

/**
 * Quy tắc chung: nút "Hiện đáp án" khi đạt đủ điểm hoặc hết lượt;
 * nội dung đáp án từ server chỉ hiện sau khi bấm (trừ khi đã có trong result sau submit).
 */
export function computeQuizAnswerRevealState(params: {
  result: QuizRevealResult | null;
  revealed: boolean;
  maxPoints: number;
  initialCorrect: boolean;
  initialPointsEarned: number;
  initialAttemptsUsed: number;
  maxAttempts: number;
  initialStudentAnswerDisplay?: string;
  initialCorrectAnswerDisplay?: string;
}) {
  const {
    result,
    revealed,
    maxPoints,
    initialCorrect,
    initialPointsEarned,
    initialAttemptsUsed,
    maxAttempts,
    initialStudentAnswerDisplay,
    initialCorrectAnswerDisplay,
  } = params;

  const fullCreditFromServer =
    initialCorrect || initialPointsEarned + QUIZ_SCORE_EPS >= maxPoints;
  const noMoreAttempts = initialAttemptsUsed >= maxAttempts;
  const locked =
    (!!result && !!result.isCorrect) ||
    (!result && (fullCreditFromServer || noMoreAttempts));

  const hasServerAnswerPayload = !!(
    initialStudentAnswerDisplay || initialCorrectAnswerDisplay
  );
  const canShowRevealButton =
    (fullCreditFromServer || noMoreAttempts) &&
    hasServerAnswerPayload &&
    !revealed &&
    !result?.correctAnswerDisplay;

  const showAnswerDetails =
    (result && (result.studentAnswerDisplay || result.correctAnswerDisplay)) ||
    (revealed &&
      (initialStudentAnswerDisplay || initialCorrectAnswerDisplay) &&
      !(result?.studentAnswerDisplay || result?.correctAnswerDisplay));

  return {
    fullCreditFromServer,
    noMoreAttempts,
    locked,
    hasServerAnswerPayload,
    canShowRevealButton,
    showAnswerDetails,
  };
}
