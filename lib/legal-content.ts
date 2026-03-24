/**
 * Split plain-text body into paragraphs (double newline = new paragraph).
 */
export function splitLegalBodyToParagraphs(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}
