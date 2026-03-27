"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

type CohortRow = {
  id: string;
  name: string;
  status: string;
  notes: string | null;
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
};

function newImportRow(): ImportRow {
  return {
    key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    email: "",
    password: "",
    student_code: "",
    full_name: "",
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

export default function WhitelistCohortsClient() {
  const modalTitleId = useId();
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [createStatus, setCreateStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    cohort: Record<string, unknown>;
    base_course_ids: string[];
    members: { id: string; email: string; student_code: string | null; full_name: string | null }[];
  } | null>(null);
  const [editBaseIds, setEditBaseIds] = useState<Set<string>>(new Set());
  const [editStatus, setEditStatus] = useState("draft");

  const [importRows, setImportRows] = useState<ImportRow[]>(() => [newImportRow()]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

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
          notes: notes.trim() || null,
          status: createStatus,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Không tạo được");
      setName("");
      setNotes("");
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
    setImportRows([newImportRow()]);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/whitelist-cohorts/${id}`, { credentials: "same-origin" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Không tải chi tiết");
      setDetail({
        cohort: j.cohort,
        base_course_ids: j.base_course_ids ?? [],
        members: j.members ?? [],
      });
      setEditBaseIds(new Set((j.base_course_ids as string[]) ?? []));
      setEditStatus((j.cohort as { status?: string }).status ?? "draft");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
      setDetail(null);
    }
  };

  const saveBases = async () => {
    if (!detailId) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/whitelist-cohorts/${detailId}/bases`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_course_ids: [...editBaseIds] }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Không lưu");
      showSuccess("Đã lưu khóa cơ bản.");
      await openDetail(detailId);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
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
        body: JSON.stringify({ status: editStatus }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Không cập nhật");
      showSuccess("Đã lưu trạng thái đợt.");
      await openDetail(detailId);
      await load();
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
      setImportRows([newImportRow()]);
      showSuccess(`Import xong: ${j.ok} dòng thành công.`);
      await openDetail(detailId);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const submitImportFromTable = () => {
    const csv = rowsToCsv(importRows);
    const lines = csv.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      setErr("Thêm ít nhất một dòng có email.");
      return;
    }
    void runImport(csv);
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

  const mergePasteIntoRows = (text: string) => {
    const parsed = parseBulkText(text);
    if (parsed.length === 0) return;
    setImportRows((prev) => {
      const kept = prev.filter((r) => r.email.trim());
      const next = parsed.map((p) => ({
        ...p,
        key: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      }));
      return [...kept, ...next, newImportRow()];
    });
  };

  const baseRows = useMemo(() => {
    const rows: { id: string; programName: string; label: string }[] = [];
    for (const prog of programs) {
      for (const b of prog.base_courses) {
        rows.push({ id: b.id, programName: prog.name, label: `${b.name} (${b.code})` });
      }
    }
    return rows;
  }, [programs]);

  const importTable = (opts: { inModal: boolean }) => (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm text-gray-200">
          <thead>
            <tr className="border-b border-white/10 bg-black/20 text-xs text-gray-400">
              <th className="px-2 py-2 font-medium">Email *</th>
              <th className="px-2 py-2 font-medium">Mật khẩu (tài khoản mới)</th>
              <th className="px-2 py-2 font-medium">Mã HV</th>
              <th className="px-2 py-2 font-medium">Họ tên</th>
              <th className="w-10 px-1 py-2" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {importRows.map((row, idx) => (
              <tr key={row.key} className="border-b border-white/5">
                <td className="px-1 py-1 align-top">
                  <input
                    className="w-full min-w-[180px] rounded border border-white/15 bg-[#0a1628] px-2 py-1.5 text-white"
                    value={row.email}
                    onChange={(e) => {
                      const v = e.target.value;
                      setImportRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, email: v } : r))
                      );
                    }}
                    placeholder="a@domain.com"
                    autoComplete="off"
                  />
                </td>
                <td className="px-1 py-1 align-top">
                  <input
                    type="password"
                    className="w-full min-w-[140px] rounded border border-white/15 bg-[#0a1628] px-2 py-1.5 text-white"
                    value={row.password}
                    onChange={(e) => {
                      const v = e.target.value;
                      setImportRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, password: v } : r))
                      );
                    }}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </td>
                <td className="px-1 py-1 align-top">
                  <input
                    className="w-full min-w-[100px] rounded border border-white/15 bg-[#0a1628] px-2 py-1.5 text-white"
                    value={row.student_code}
                    onChange={(e) => {
                      const v = e.target.value;
                      setImportRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, student_code: v } : r))
                      );
                    }}
                  />
                </td>
                <td className="px-1 py-1 align-top">
                  <input
                    className="w-full min-w-[140px] rounded border border-white/15 bg-[#0a1628] px-2 py-1.5 text-white"
                    value={row.full_name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setImportRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, full_name: v } : r))
                      );
                    }}
                  />
                </td>
                <td className="px-1 py-1 align-top">
                  <button
                    type="button"
                    className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                    onClick={() => {
                      setImportRows((prev) => {
                        if (prev.length <= 1) return [newImportRow()];
                        return prev.filter((_, i) => i !== idx);
                      });
                    }}
                    aria-label="Xóa dòng"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/5"
          onClick={() => setImportRows((prev) => [...prev, newImportRow()])}
        >
          + Thêm dòng
        </button>
        {!opts.inModal && (
          <button
            type="button"
            className="rounded-full border border-[#D4AF37]/50 px-4 py-2 text-sm text-[#D4AF37] hover:bg-[#D4AF37]/10"
            onClick={() => setImportModalOpen(true)}
          >
            Nhập nhanh (dán / file)…
          </button>
        )}
        <label className="cursor-pointer rounded-full border border-white/20 px-4 py-2 text-sm text-gray-300 hover:bg-white/5">
          Chọn file .csv
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => {
                const t = String(reader.result ?? "");
                mergePasteIntoRows(t);
                e.target.value = "";
              };
              reader.readAsText(f, "UTF-8");
            }}
          />
        </label>
      </div>
      <p className="text-xs text-gray-500">
        Tài khoản mới: mật khẩu tối thiểu 10 ký tự, có chữ hoa, thường và số. Email đã tồn tại: có thể để trống mật khẩu.
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
        <label className="mt-3 block text-sm text-gray-300">
          Ghi chú
          <textarea
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
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
                Lưu trạng thái
              </button>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-200">Khóa cơ bản được miễn phí</h3>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#0a1628]/80 p-3">
              {baseRows.map((row) => (
                <label key={row.id} className="flex cursor-pointer items-start gap-2 py-1 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={editBaseIds.has(row.id)}
                    onChange={(e) => {
                      const next = new Set(editBaseIds);
                      if (e.target.checked) next.add(row.id);
                      else next.delete(row.id);
                      setEditBaseIds(next);
                    }}
                    className="mt-1"
                  />
                  <span>
                    {row.label}
                    <span className="block text-xs text-gray-500">{row.programName}</span>
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveBases()}
              className="mt-3 rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-[#0a1628] disabled:opacity-50"
            >
              Lưu khóa cơ bản
            </button>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-200">Thêm học viên vào đợt</h3>
            {importTable({ inModal: false })}
            <button
              type="button"
              disabled={saving}
              onClick={() => void submitImportFromTable()}
              className="mt-3 rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-[#0a1628] disabled:opacity-50"
            >
              Gửi danh sách
            </button>
            {importResult && (
              <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-300">
                {importResult}
              </pre>
            )}
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-200">Thành viên ({detail.members.length})</h3>
            <div className="mt-2 max-h-56 overflow-y-auto text-sm">
              <table className="w-full border-collapse text-left text-gray-300">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-gray-500">
                    <th className="py-2 pr-2">Email</th>
                    <th className="py-2 pr-2">Mã HV</th>
                    <th className="py-2">Họ tên</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.members.map((m) => (
                    <tr key={m.id} className="border-b border-white/5">
                      <td className="py-1.5 pr-2">{m.email}</td>
                      <td className="py-1.5 pr-2">{m.student_code ?? "—"}</td>
                      <td className="py-1.5">{m.full_name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      {importModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
          onClick={(e) => {
            if (e.target === e.currentTarget) setImportModalOpen(false);
          }}
          onPaste={(e) => {
            const t = e.clipboardData?.getData("text/plain");
            if (t?.trim()) {
              e.preventDefault();
              mergePasteIntoRows(t);
            }
          }}
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-white/15 bg-[#0f1f38] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id={modalTitleId} className="text-lg font-semibold text-white">
              Nhập nhanh — dán từ Excel hoặc chọn file
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              Dán vào cửa sổ này (Ctrl+V): cột theo thứ tự email, mật khẩu, mã HV, họ tên — hoặc dùng file CSV có dòng tiêu đề.
            </p>
            <div className="mt-4">{importTable({ inModal: true })}</div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-[#0a1628]"
                onClick={() => {
                  setImportModalOpen(false);
                }}
              >
                Xong — quay lại màn chi tiết
              </button>
              <button
                type="button"
                className="rounded-full border border-white/20 px-5 py-2 text-sm text-gray-300 hover:bg-white/5"
                onClick={() => setImportModalOpen(false)}
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
