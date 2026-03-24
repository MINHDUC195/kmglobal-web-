/**
 * Build display strings for student answer from attempt + options map.
 */
export function buildStudentAnswerDisplay(
  questionType: string,
  selectedOptionIds: string[] | null,
  fillBlankAnswer: string | null,
  optionTextById: Map<string, string>
): string {
  if (questionType === "fill_blank") {
    const t = typeof fillBlankAnswer === "string" ? fillBlankAnswer.trim() : "";
    return t || "(để trống)";
  }
  const ids = Array.isArray(selectedOptionIds) ? selectedOptionIds : [];
  const texts = ids
    .map((id) => optionTextById.get(id))
    .filter(Boolean) as string[];
  return texts.length ? texts.join(", ") : "(chưa chọn)";
}

export function buildCorrectAnswerDisplay(
  correctOptionTexts: string[]
): string {
  return correctOptionTexts.filter(Boolean).join(", ");
}
