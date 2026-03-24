/**
 * Ẩn một phần email cho API công khai (tra cứu chứng chỉ).
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") return "—";
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at < 1) return "—";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return "—";
  const visible = local.length <= 2 ? "*" : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}
