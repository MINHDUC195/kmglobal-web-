import * as XLSX from "xlsx";

export type ParsedWhitelistRow = {
  email: string;
  password: string;
  student_code: string;
  full_name: string;
};

function normHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findCol(headers: string[], ...patterns: string[]): number {
  const n = headers.map(normHeader);
  for (const p of patterns) {
    const lp = p.toLowerCase();
    const i = n.findIndex((h) => h.includes(lp) || h === lp);
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * Đọc sheet đầu tiên: dòng 1 có thể là tiêu đề (email, password, …) hoặc dữ liệu.
 */
export function parseWhitelistExcelBuffer(buffer: ArrayBuffer): ParsedWhitelistRow[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null | undefined)[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (rows.length === 0) return [];

  const first = rows[0].map((c) => String(c ?? "").trim());
  const headerLike = first.some((h) => /email|mail|e-mail/i.test(h) || normHeader(h).includes("email"));

  let startRow = 0;
  let colEmail = 0;
  let colPass = 1;
  let colCode = 2;
  let colName = 3;

  if (headerLike) {
    const headers = first;
    const ei = findCol(headers, "email", "mail");
    const pi = findCol(headers, "password", "matkhau", "mat khau", "pass");
    const ci = findCol(headers, "student", "ma hv", "mahv", "code", "ma");
    const ni = findCol(headers, "full", "name", "hoten", "ho ten");
    if (ei >= 0) colEmail = ei;
    if (pi >= 0) colPass = pi;
    if (ci >= 0) colCode = ci;
    if (ni >= 0) colName = ni;
    startRow = 1;
  }

  const out: ParsedWhitelistRow[] = [];
  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const email = String(row[colEmail] ?? "").trim();
    if (!email) continue;
    out.push({
      email,
      password: String(row[colPass] ?? "").trim(),
      student_code: String(row[colCode] ?? "").trim(),
      full_name: String(row[colName] ?? "").trim(),
    });
  }
  return out;
}
