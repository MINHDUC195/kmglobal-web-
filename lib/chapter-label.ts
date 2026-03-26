export function normalizeChapterLabel(raw?: string | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "Chapter";

  const weekMatch = /^week\s*(\d+)(.*)$/i.exec(trimmed);
  if (weekMatch) {
    const number = weekMatch[1];
    const suffix = weekMatch[2]?.trim();
    return suffix ? `Chapter ${number} ${suffix}` : `Chapter ${number}`;
  }

  return trimmed;
}
