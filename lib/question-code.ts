import type { SupabaseClient } from "@supabase/supabase-js";

/** Chuẩn hóa phần mã từ mã chương trình / khóa học (chữ số, không dấu). */
function slugCodePart(raw: string | null | undefined): string {
  if (!raw?.trim()) return "X";
  const s = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
  return (s.slice(0, 28) || "X") as string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Mã dạng: {MãCT}-{MãKH}-{STT 3 số}. Nếu không có khóa (chỉ chương trình): {MãCT}-Q-{STT}.
 */
export async function generateNextQuestionCode(
  supabase: SupabaseClient,
  programId: string,
  programCode: string,
  baseCourseCode: string | null
): Promise<string> {
  const p = slugCodePart(programCode);
  const c = baseCourseCode ? slugCodePart(baseCourseCode) : "Q";
  const prefix = `${p}-${c}`;

  const { data: rows, error } = await supabase
    .from("questions")
    .select("code")
    .eq("program_id", programId);

  if (error) throw new Error(error.message);

  const re = new RegExp(`^${escapeRegex(prefix)}-(\\d+)$`);
  let max = 0;
  for (const row of rows ?? []) {
    const code = (row as { code?: string | null }).code;
    if (!code) continue;
    const m = code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }

  const next = max + 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}
