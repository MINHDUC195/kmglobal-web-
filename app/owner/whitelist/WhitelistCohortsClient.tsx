"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

function statusLabelVi(s: string) {
  if (s === "active") return "Đang áp dụng";
  if (s === "draft") return "Nháp";
  if (s === "archived") return "Lưu trữ";
  return s;
}

export default function WhitelistCohortsClient() {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<string | null>(null);

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
      await openDetail(detailId);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  };

  const runImport = async () => {
    if (!detailId || !importText.trim()) return;
    setSaving(true);
    setErr(null);
    setImportResult(null);
    try {
      const res = await fetch(`/api/owner/whitelist-cohorts/${detailId}/import`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importText }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Import thất bại");
      const parts = [`Thành công: ${j.ok}`, `Lỗi: ${j.failed}`];
      if (Array.isArray(j.errors) && j.errors.length) {
        parts.push(
          j.errors.slice(0, 8).map((x: { line: number; message: string }) => `Dòng ${x.line}: ${x.message}`).join("\n")
        );
      }
      setImportResult(parts.join("\n"));
      setImportText("");
      await openDetail(detailId);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
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

  if (loading) {
    return <p className="text-gray-400">Đang tải…</p>;
  }

  return (
    <div className="space-y-10">
      {err && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{err}</div>
      )}

      <section className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Tạo đợt whitelist mới</h2>
        <p className="mt-1 text-sm text-gray-400">
          Kích hoạt đợt khi đã gắn base và import danh sách. Một học viên chỉ được một suất miễn phí / khóa cơ bản.
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
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <span className="font-medium text-white">{c.name}</span>
                  <span className="ml-2 text-xs text-gray-500">{statusLabelVi(c.status)}</span>
                  <p className="text-xs text-gray-500">
                    {c.member_count} học viên · {c.base_count} khóa cơ bản
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void openDetail(c.id)}
                  className="text-sm text-[#D4AF37] hover:underline"
                >
                  Chi tiết
                </button>
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
                className="rounded-full border border-[#D4AF37]/60 px-4 py-2 text-sm text-[#D4AF37] hover:bg-[#D4AF37]/10"
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
            <h3 className="text-sm font-semibold text-gray-200">Import CSV</h3>
            <p className="mt-1 text-xs text-gray-500">
              Dòng đầu: <code className="text-gray-300">email,password,student_code,full_name</code> — tài khoản mới cần mật khẩu đủ mạnh (10+ ký tự, hoa, thường, số). Dòng đã có email trong hệ thống: chỉ cần thêm vào đợt (mật khẩu có thể để trống).
            </p>
            <textarea
              className="mt-2 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 font-mono text-sm text-white"
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`email,password,student_code,full_name\na@example.com,Abcd123456,HV001,Nguyễn Văn A`}
            />
            <button
              type="button"
              disabled={saving || !importText.trim()}
              onClick={() => void runImport()}
              className="mt-2 rounded-full border border-white/20 px-5 py-2 text-sm text-white hover:bg-white/5 disabled:opacity-50"
            >
              Import
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
    </div>
  );
}
