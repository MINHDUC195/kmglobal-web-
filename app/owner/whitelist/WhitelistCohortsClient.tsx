"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import { parseWhitelistExcelBuffer } from "@/lib/whitelist-excel-import";

type CohortRow = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
  applies_from?: string | null;
  applies_until?: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  base_count: number;
};

type ProgramRow = {
  id: string;
  name: string;
  code: string | null;
  base_courses: { id: string; name: string; code: string }[];
};

type ImportRow = {
  key: string;
  email: string;
  password: string;
  student_code: string;
  full_name: string;
  /** Email khớp profile — không bắt buộc mật khẩu, tự điền tên/mã */
  existingAccount?: boolean;
};

function newImportRow(): ImportRow {
  return {
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    email: "",
    password: "",
    student_code: "",
    full_name: "",
    existingAccount: false,
  };
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: ImportRow[]): string {
  const header = "email,password,student_code,full_name";
  const dataLines = rows
    .filter((r) => r.email.trim().length > 0)
    .map((r) =>
      [r.email.trim(), r.password, r.student_code.trim(), r.full_name.trim()].map(escapeCsvCell).join(",")
    );
  return [header, ...dataLines].join("\n");
}

/** Dán từ Excel: tab; hoặc dòng CSV. */
function parseBulkText(text: string): Omit<ImportRow, "key">[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const first = lines[0];
  const lower = first.toLowerCase();
  let start = 0;
  if (lower.includes("email") && (lower.includes("password") || lower.includes("full"))) {
    start = 1;
  }
  const out: Omit<ImportRow, "key">[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.includes("\t") ? line.split("\t") : parseCsvLine(line);
    const email = (parts[0] ?? "").trim();
    if (!email) continue;
    out.push({
      email,
      password: (parts[1] ?? "").trim(),
      student_code: (parts[2] ?? "").trim(),
      full_name: (parts[3] ?? "").trim(),
    });
  }
  return out;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function statusLabelVi(s: string) {
  if (s === "active") return "Đang áp dụng";
  if (s === "draft") return "Nháp";
  if (s === "archived") return "Lưu trữ";
  return s;
}

function isoToDatetimeLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalInputToIso(local: string): string | null {
  const t = local.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatAppliesRangeVi(from: string | null | undefined, until: string | null | undefined): string {
  if (!from && !until) return "Chưa đặt khoảng thời gian áp dụng";
  const opts: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };
  try {
    if (from && until) {
      return `${new Date(from).toLocaleString("vi-VN", opts)} → ${new Date(until).toLocaleString("vi-VN", opts)}`;
    }
    if (from) return `Từ ${new Date(from).toLocaleString("vi-VN", opts)}`;
    if (until) return `Đến ${new Date(until).toLocaleString("vi-VN", opts)}`;
  } catch {
    return "—";
  }
  return "—";
}

type SelectedBaseRow = {
  key: string;
  programId: string;
  programName: string;
  baseId: string;
  baseLabel: string;
};

function rowKey(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function buildRowsFromBaseIds(baseIds: string[], programList: ProgramRow[]): SelectedBaseRow[] {
  const rows: SelectedBaseRow[] = [];
  for (const id of baseIds) {
    let found = false;
    for (const prog of programList) {
      const b = prog.base_courses.find((x) => x.id === id);
      if (b) {
        rows.push({
          key: rowKey(),
          programId: prog.id,
          programName: prog.name,
          baseId: b.id,
          baseLabel: `${b.name} (${b.code})`,
        });
        found = true;
        break;
      }
    }
    if (!found) {
      rows.push({
        key: rowKey(),
        programId: "",
        programName: "—",
        baseId: id,
        baseLabel: `Khóa không còn trong danh mục (${id.slice(0, 8)}…)`,
      });
    }
  }
  return rows;
}

export default function WhitelistCohortsClient() {
  const modalTitleId = useId();
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [createStatus, setCreateStatus] = useState("draft");
  const [createAppliesFrom, setCreateAppliesFrom] = useState("");
  const [createAppliesUntil, setCreateAppliesUntil] = useState("");
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    cohort: Record<string, unknown>;
    base_course_ids: string[];
  } | null>(null);
  /** Các khóa cơ bản đã chọn (mỗi khóa một hàng). */
  const [selectedBaseRows, setSelectedBaseRows] = useState<SelectedBaseRow[]>([]);
  const [pickerProgramId, setPickerProgramId] = useState("");
  const [pickerChecked, setPickerChecked] = useState<Set<string>>(new Set());
  const [editStatus, setEditStatus] = useState("draft");
  const [editAppliesFrom, setEditAppliesFrom] = useState("");
  const [editAppliesUntil, setEditAppliesUntil] = useState("");

  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  /** null = thêm mới */
  const [memberModalEditKey, setMemberModalEditKey] = useState<string | null>(null);
  const [memberDraft, setMemberDraft] = useState<{
    email: string;
    password: string;
    student_code: string;
    full_name: string;
    existingAccount: boolean;
  }>({
    email: "",
    password: "",
    student_code: "",
    full_name: "",
    existingAccount: false,
  });

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setErr(null);
    window.setTimeout(() => setSuccessMsg(null), 4500);
  }, []);

  const load = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [prRes, coRes] = await Promise.all([
        fetch("/api/owner/org-domain-programs", { credentials: "same-origin" }),
        fetch("/api/owner/whitelist-cohorts", { credentials: "same-origin" }),
      ]);
      const pr = await prRes.json();
      const co = await coRes.json();
      if (!prRes.ok) throw new Error(pr.error || "Không tải chương trình");
      if (!coRes.ok) throw new Error(co.error || "Không tải đợt whitelist");
      setPrograms(Array.isArray(pr.programs) ? pr.programs : []);
      setCohorts(Array.isArray(co.cohorts) ? co.cohorts : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/owner/whitelist-cohorts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          notes: null,
          status: createStatus,
          applies_from: datetimeLocalInputToIso(createAppliesFrom),
          applies_until: datetimeLocalInputToIso(createAppliesUntil),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Không tạo được");
      setName("");
      setCreateAppliesFrom("");
      setCreateAppliesUntil("");
      showSuccess("Đã tạo đợt whitelist.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailId(id);
    setImportResult(null);
    setImportRows([]);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/whitelist-cohorts/${id}`, { credentials: "same-origin" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Không tải chi tiết");
      const baseIds = (j.base_course_ids as string[]) ?? [];
      setDetail({
        cohort: j.cohort,
        base_course_ids: baseIds,
      });
      setSelectedBaseRows(buildRowsFromBaseIds(baseIds, programs));
      setPickerProgramId(programs[0]?.id ?? "");
      setPickerChecked(new Set());
      const ch = j.cohort as {
        status?: string;
        applies_from?: string | null;
        applies_until?: string | null;
      };
      setEditStatus(ch.status ?? "draft");
      setEditAppliesFrom(isoToDatetimeLocalInput(ch.applies_from));
      setEditAppliesUntil(isoToDatetimeLocalInput(ch.applies_until));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
      setDetail(null);
    }
  };

  /** Lưu danh sách base — không mở lại chi tiết. Trả về true nếu thành công (để cập nhật state local). */
  const persistBases = async (baseIds: string[]): Promise<boolean> => {
    if (!detailId) return false;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/whitelist-cohorts/${detailId}/bases`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_course_ids: [...new Set(baseIds)] }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "Không lưu được");
        return false;
      }
      setDetail((d) => (d ? { ...d, base_course_ids: [...new Set(baseIds)] } : null));
      showSuccess("Đã cập nhật khóa cơ bản.");
      await load();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveCohortMeta = async () => {
    if (!detailId) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/whitelist-cohorts/${detailId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          applies_from: datetimeLocalInputToIso(editAppliesFrom),
          applies_until: datetimeLocalInputToIso(editAppliesUntil),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Không cập nhật");
      if (j.cohort) {
        setDetail((d) => (d ? { ...d, cohort: j.cohort as Record<string, unknown> } : null));
      }
      showSuccess("Đã lưu trạng thái và khoảng thời gian áp dụng.");
      await load();
      setDetailId(null);
      setDetail(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const runImport = async (csv: string) => {
    if (!detailId || !csv.trim()) return;
    setSaving(true);
    setErr(null);
    setImportResult(null);
    try {
      const res = await fetch(`/api/owner/whitelist-cohorts/${detailId}/import`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Import thất bại");
      const parts = [`Thành công: ${j.ok}`, `Lỗi: ${j.failed}`];
      if (Array.isArray(j.errors) && j.errors.length) {
        parts.push(
          j.errors
            .slice(0, 12)
            .map((x: { line: number; message: string }) => `Dòng ${x.line}: ${x.message}`)
            .join("\n")
        );
      }
      setImportResult(parts.join("\n"));
      setImportRows([]);
      showSuccess(`Import xong: ${j.ok} dòng thành công.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const deleteCohort = async (id: string, cohortName: string) => {
    if (
      !window.confirm(
        `Xóa đợt "${cohortName}"? Thao tác không hoàn tác. Không xóa được nếu đã có học viên dùng suất miễn phí.`
      )
    ) {
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/whitelist-cohorts/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Không xóa được");
      if (detailId === id) {
        setDetailId(null);
        setDetail(null);
      }
      showSuccess("Đã xóa đợt.");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const lookupEmailDraft = async (emailRaw: string) => {
    const e = emailRaw.trim().toLowerCase();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      setMemberDraft((d) => ({ ...d, existingAccount: false }));
      return;
    }
    try {
      const res = await fetch(`/api/owner/profile-by-email?email=${encodeURIComponent(e)}`, {
        credentials: "same-origin",
      });
      const j = (await res.json()) as {
        found?: boolean;
        full_name?: string;
        student_code?: string;
      };
      if (res.ok && j.found) {
        setMemberDraft((d) => ({
          ...d,
          existingAccount: true,
          password: "",
          full_name: (j.full_name && j.full_name.trim()) || d.full_name,
          student_code: (j.student_code && j.student_code.trim()) || d.student_code,
        }));
      } else {
        setMemberDraft((d) => ({ ...d, existingAccount: false }));
      }
    } catch {
      setMemberDraft((d) => ({ ...d, existingAccount: false }));
    }
  };

  const openMemberModalAdd = () => {
    setMemberModalEditKey(null);
    setMemberDraft({
      email: "",
      password: "",
      student_code: "",
      full_name: "",
      existingAccount: false,
    });
    setMemberModalOpen(true);
  };

  const openMemberModalEdit = (row: ImportRow) => {
    setMemberModalEditKey(row.key);
    setMemberDraft({
      email: row.email,
      password: row.password,
      student_code: row.student_code,
      full_name: row.full_name,
      existingAccount: row.existingAccount ?? false,
    });
    setMemberModalOpen(true);
  };

  const saveMemberModal = async () => {
    const email = memberDraft.email.trim();
    if (!email) {
      setErr("Nhập email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr("Email không hợp lệ.");
      return;
    }
    setErr(null);
    let nextRows: ImportRow[];
    if (memberModalEditKey === null) {
      const row: ImportRow = {
        ...newImportRow(),
        email,
        password: memberDraft.existingAccount ? "" : memberDraft.password,
        student_code: memberDraft.student_code.trim(),
        full_name: memberDraft.full_name.trim(),
        existingAccount: memberDraft.existingAccount,
      };
      nextRows = [...importRows, row];
    } else {
      nextRows = importRows.map((r) =>
        r.key === memberModalEditKey
          ? {
              ...r,
              email,
              password: memberDraft.existingAccount ? "" : memberDraft.password,
              student_code: memberDraft.student_code.trim(),
              full_name: memberDraft.full_name.trim(),
              existingAccount: memberDraft.existingAccount,
            }
          : r
      );
    }
    setImportRows(nextRows);
    setMemberModalOpen(false);
    const csv = rowsToCsv(nextRows);
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length >= 2) {
      await runImport(csv);
    }
  };

  const mergeParsedIntoRowsAndImport = (
    parsed: Omit<ImportRow, "key" | "existingAccount">[]
  ) => {
    if (parsed.length === 0) return;
    setImportRows((prev) => {
      const appended: ImportRow[] = parsed.map((p) => ({
        ...p,
        key: rowKey(),
        existingAccount: false,
      }));
      const merged = [...prev, ...appended];
      const csv = rowsToCsv(merged);
      const lines = csv.split(/\r?\n/).filter(Boolean);
      if (lines.length >= 2) {
        queueMicrotask(() => void runImport(csv));
      }
      return merged;
    });
  };

  const pickerProgram = useMemo(
    () => programs.find((p) => p.id === pickerProgramId) ?? programs[0] ?? null,
    [programs, pickerProgramId]
  );

  const addPickerBasesToList = async () => {
    const prog = pickerProgram;
    if (!prog) {
      setErr("Chưa có chương trình để chọn.");
      return;
    }
    const ids = [...pickerChecked];
    if (ids.length === 0) {
      setErr("Chọn ít nhất một khóa cơ bản (ô tick) rồi bấm OK.");
      return;
    }
    setErr(null);

    const have = new Set(selectedBaseRows.map((r) => r.baseId));
    const next = [...selectedBaseRows];
    for (const baseId of ids) {
      if (have.has(baseId)) continue;
      const b = prog.base_courses.find((x) => x.id === baseId);
      if (!b) continue;
      next.push({
        key: rowKey(),
        programId: prog.id,
        programName: prog.name,
        baseId: b.id,
        baseLabel: `${b.name} (${b.code})`,
      });
      have.add(baseId);
    }

    const baseIds = [...new Set(next.map((r) => r.baseId))];
    const ok = await persistBases(baseIds);
    if (ok) {
      setSelectedBaseRows(next);
      setPickerChecked(new Set());
    }
  };

  const removeSelectedBaseRow = async (key: string) => {
    if (!window.confirm("Xóa khóa này khỏi danh sách đợt whitelist?")) {
      return;
    }
    const next = selectedBaseRows.filter((r) => r.key !== key);
    const baseIds = [...new Set(next.map((r) => r.baseId))];
    const ok = await persistBases(baseIds);
    if (ok) {
      setSelectedBaseRows(next);
    }
  };

  const importTableBlock = (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm text-gray-200">
          <thead>
            <tr className="border-b border-white/10 bg-black/20 text-xs text-gray-400">
              <th className="px-2 py-2 font-medium">Email *</th>
              <th className="px-2 py-2 font-medium">Mật khẩu</th>
              <th className="px-2 py-2 font-medium">Mã HV</th>
              <th className="px-2 py-2 font-medium">Họ tên</th>
              <th className="min-w-[100px] px-2 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {importRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-500">
                  Chưa có dòng nào. Bấm &quot;+ Thêm dòng&quot; để nhập trong hộp thoại, hoặc chọn file Excel / CSV để nhập hàng loạt.
                </td>
              </tr>
            ) : (
              importRows.map((row) => (
                <tr key={row.key} className="border-b border-white/5">
                  <td className="px-2 py-2 align-top text-gray-100">{row.email || "—"}</td>
                  <td className="px-2 py-2 align-top">
                    {row.existingAccount ? (
                      <span className="text-xs text-emerald-200/90">Đã có tài khoản</span>
                    ) : row.password ? (
                      <span className="tracking-widest text-gray-400">••••••••</span>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2 align-top text-gray-200">{row.student_code || "—"}</td>
                  <td className="px-2 py-2 align-top text-gray-200">{row.full_name || "—"}</td>
                  <td className="px-2 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs text-[#D4AF37] hover:bg-[#D4AF37]/10"
                        onClick={() => openMemberModalEdit(row)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                        onClick={() => {
                          setImportRows((prev) => prev.filter((r) => r.key !== row.key));
                        }}
                        aria-label="Xóa dòng"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
          onClick={() => openMemberModalAdd()}
        >
          + Thêm dòng
        </button>
        <label className="cursor-pointer rounded-full border border-white/20 px-4 py-2 text-sm text-gray-300 hover:bg-white/5">
          Chọn file Excel / CSV
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const name = f.name.toLowerCase();
              const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");
              if (isExcel) {
                const reader = new FileReader();
                reader.onload = () => {
                  const buf = reader.result;
                  if (buf instanceof ArrayBuffer) {
                    try {
                      const parsed = parseWhitelistExcelBuffer(buf);
                      mergeParsedIntoRowsAndImport(parsed);
                    } catch (err) {
                      setErr(err instanceof Error ? err.message : "Không đọc được file Excel.");
                    }
                  }
                  e.target.value = "";
                };
                reader.readAsArrayBuffer(f);
              } else {
                const reader = new FileReader();
                reader.onload = () => {
                  const t = String(reader.result ?? "");
                  const parsed = parseBulkText(t);
                  mergeParsedIntoRowsAndImport(parsed);
                  e.target.value = "";
                };
                reader.readAsText(f, "UTF-8");
              }
            }}
          />
        </label>
      </div>
      <p className="text-xs text-gray-500">
        Trong hộp thoại Thêm/Sửa: nhập email rồi rời khỏi ô — nếu đã có trong hệ thống, hệ thống tự điền họ tên và mã HV; không cần mật khẩu. Tài khoản mới: mật khẩu tối thiểu 10 ký tự, có chữ hoa, thường và số. File Excel: cột email, mật khẩu, mã HV, họ tên (có thể có dòng tiêu đề).
      </p>
    </div>
  );

  if (loading) {
    return <p className="text-gray-400">Đang tải…</p>;
  }

  return (
    <div className="space-y-10">
      {successMsg && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {successMsg}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
      )}

      <section className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Tạo đợt whitelist mới</h2>
        <p className="mt-1 text-sm text-gray-400">
          Kích hoạt đợt khi đã gắn base và thêm học viên. Một học viên chỉ được một suất miễn phí / khóa cơ bản.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm text-gray-300">
            Tên đợt
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Đợt Q2 2026"
            />
          </label>
          <label className="text-sm text-gray-300">
            Trạng thái
            <select
              className="mt-1 block w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white sm:w-40"
              value={createStatus}
              onChange={(e) => setCreateStatus(e.target.value)}
            >
              <option value="draft">Nháp</option>
              <option value="active">Đang áp dụng</option>
              <option value="archived">Lưu trữ</option>
            </select>
          </label>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={() => void create()}
            className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-[#0a1628] disabled:opacity-50"
          >
            Tạo
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-300">
            Áp dụng từ
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white"
              value={createAppliesFrom}
              onChange={(e) => setCreateAppliesFrom(e.target.value)}
            />
          </label>
          <label className="text-sm text-gray-300">
            Đến
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white"
              value={createAppliesUntil}
              onChange={(e) => setCreateAppliesUntil(e.target.value)}
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Để trống nếu chưa giới hạn đầu/cuối. Có thể chỉnh lại trong chi tiết đợt.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-white">Danh sách đợt</h2>
        <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10">
          {cohorts.length === 0 ? (
            <li className="px-4 py-6 text-sm text-gray-400">Chưa có đợt nào.</li>
          ) : (
            cohorts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <span className="font-medium text-white">{c.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{statusLabelVi(c.status)}</span>
                  <p className="text-xs text-[#D4AF37]/90">
                    {formatAppliesRangeVi(c.applies_from, c.applies_until)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {c.member_count} học viên · {c.base_count} khóa cơ bản
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void openDetail(c.id)}
                    className="text-sm text-[#D4AF37] hover:underline"
                  >
                    Chi tiết
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void deleteCohort(c.id, c.name)}
                    className="rounded-full border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Xóa
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      {detail && detailId && (
        <section className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{(detail.cohort as { name?: string }).name}</h2>
              <p className="text-xs text-gray-500">ID: {detailId}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-sm text-white"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
              >
                <option value="draft">Nháp</option>
                <option value="active">Đang áp dụng</option>
                <option value="archived">Lưu trữ</option>
              </select>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveCohortMeta()}
                className="rounded-full border border-[#D4AF37]/60 px-4 py-2 text-sm text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-50"
              >
                Lưu cài đặt đợt
              </button>
            </div>
          </div>

          <div className="mt-4 w-full border-t border-white/10 pt-4">
            <p className="text-xs font-medium text-gray-400">Khoảng thời gian áp dụng</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-gray-300">
                Từ
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white"
                  value={editAppliesFrom}
                  onChange={(e) => setEditAppliesFrom(e.target.value)}
                />
              </label>
              <label className="text-sm text-gray-300">
                Đến
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white"
                  value={editAppliesUntil}
                  onChange={(e) => setEditAppliesUntil(e.target.value)}
                />
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500">Để trống = không giới hạn đầu hoặc cuối.</p>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-200">Khóa cơ bản được miễn phí</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-400">Chương trình</label>
                <select
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-sm text-white"
                  value={
                    programs.some((p) => p.id === pickerProgramId)
                      ? pickerProgramId
                      : (programs[0]?.id ?? "")
                  }
                  onChange={(e) => {
                    setPickerProgramId(e.target.value);
                    setPickerChecked(new Set());
                  }}
                >
                  {programs.length === 0 ? (
                    <option value="">Đang tải chương trình…</option>
                  ) : (
                    programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="flex min-h-[120px] flex-col">
                <span className="text-xs font-medium text-gray-400">Khóa cơ bản</span>
                <div className="mt-1 max-h-48 flex-1 overflow-y-auto rounded-lg border border-white/10 bg-[#0a1628]/80 p-2">
                  {pickerProgram && pickerProgram.base_courses.length > 0 ? (
                    pickerProgram.base_courses.map((b) => (
                      <label
                        key={b.id}
                        className="flex cursor-pointer items-start gap-2 border-b border-white/5 py-1.5 text-sm text-gray-300 last:border-0"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={pickerChecked.has(b.id)}
                          onChange={(e) => {
                            setPickerChecked((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(b.id);
                              else next.delete(b.id);
                              return next;
                            });
                          }}
                        />
                        <span>
                          {b.name} <span className="text-gray-500">({b.code})</span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">Không có khóa trong chương trình này.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={saving || !pickerProgram || programs.length === 0}
                onClick={() => void addPickerBasesToList()}
                className="rounded-full bg-[#D4AF37]/20 px-6 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/25 disabled:opacity-50"
              >
                OK
              </button>
              <span className="text-xs text-gray-500">Đang tick trong lượt này: {pickerChecked.size} khóa</span>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Danh sách đã chọn ({selectedBaseRows.length})
              </h4>
              <div className="mt-2 overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-black/20 text-xs text-gray-500">
                      <th className="px-3 py-2 font-medium">Chương trình</th>
                      <th className="px-3 py-2 font-medium">Khóa cơ bản</th>
                      <th className="w-20 px-2 py-2 text-right font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBaseRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-xs text-gray-500">
                          Chưa có khóa. Chọn chương trình → tick khóa → OK.
                        </td>
                      </tr>
                    ) : (
                      selectedBaseRows.map((r) => (
                        <tr key={r.key} className="border-b border-white/5">
                          <td className="px-3 py-2 text-gray-300">{r.programName}</td>
                          <td className="px-3 py-2 text-gray-100">{r.baseLabel}</td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              className="text-xs text-red-300 hover:underline"
                              onClick={() => void removeSelectedBaseRow(r.key)}
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Danh sách khóa được lưu tự động khi bấm OK hoặc khi xóa một hàng.
            </p>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-200">Thêm học viên vào đợt</h3>
            {importTableBlock}
            {importResult && (
              <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
                {importResult}
              </pre>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setDetailId(null);
              setDetail(null);
            }}
            className="mt-6 text-sm text-gray-500 hover:text-gray-300"
          >
            Đóng chi tiết
          </button>
        </section>
      )}

      {memberModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMemberModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-white/15 bg-[#0f1f38] p-6 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 id={modalTitleId} className="text-lg font-semibold text-white">
              {memberModalEditKey === null ? "Thêm học viên" : "Sửa học viên"}
            </h3>
            <div className="mt-4 space-y-3">
              <label className="block text-sm text-gray-300">
                Email *
                <input
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white"
                  value={memberDraft.email}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMemberDraft((d) => ({ ...d, email: v, existingAccount: false }));
                  }}
                  onBlur={(e) => void lookupEmailDraft(e.target.value)}
                  placeholder="a@domain.com"
                  autoComplete="off"
                />
              </label>
              {memberDraft.existingAccount ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200/90">
                  Đã có tài khoản — không cần mật khẩu.
                </div>
              ) : (
                <label className="block text-sm text-gray-300">
                  Mật khẩu (khi tạo tài khoản mới)
                  <input
                    type="password"
                    className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white"
                    value={memberDraft.password}
                    onChange={(e) => setMemberDraft((d) => ({ ...d, password: e.target.value }))}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </label>
              )}
              <label className="block text-sm text-gray-300">
                Mã HV
                <input
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white"
                  value={memberDraft.student_code}
                  onChange={(e) => setMemberDraft((d) => ({ ...d, student_code: e.target.value }))}
                />
              </label>
              <label className="block text-sm text-gray-300">
                Họ tên
                <input
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white"
                  value={memberDraft.full_name}
                  onChange={(e) => setMemberDraft((d) => ({ ...d, full_name: e.target.value }))}
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-[#0a1628] disabled:opacity-50"
                onClick={() => void saveMemberModal()}
              >
                Lưu và gửi lên đợt
              </button>
              <button
                type="button"
                className="rounded-full border border-white/20 px-5 py-2 text-sm text-gray-300 hover:bg-white/5"
                onClick={() => setMemberModalOpen(false)}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
