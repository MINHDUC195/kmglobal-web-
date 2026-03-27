"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ORG_DOMAIN_SCHEMA_MISSING_CODE } from "@/lib/org-domain-schema-error";

function isOrgDomainSchemaMissingResponse(res: Response, body: { code?: string }) {
  return res.status === 503 && body.code === ORG_DOMAIN_SCHEMA_MISSING_CODE;
}

function formatPolicyDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function statusLabelVi(s: string) {
  if (s === "active") return "Kích hoạt";
  if (s === "draft") return "Nháp";
  if (s === "suspended") return "Tạm dừng";
  return s;
}

type ProgramRow = {
  id: string;
  name: string;
  code: string | null;
  base_courses: { id: string; name: string; code: string }[];
};

type PolicyList = {
  id: string;
  email_domain: string;
  status: string;
  max_users: number;
  unused_expiry_years: number;
  notes: string | null;
  seats_used: number;
  created_at: string;
  program_names: string[];
  base_course_labels: string[];
  reference_end_at: string;
};

type EntRow = {
  id: string;
  user_id: string;
  email: string | null;
  granted_at: string;
  first_used_at: string | null;
  unused_expiry_deadline: string;
  revoked_at: string | null;
  revoked_reason: string | null;
};

export default function OrgDomainClient() {
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [policies, setPolicies] = useState<PolicyList[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [domain, setDomain] = useState("");
  const [maxUsers, setMaxUsers] = useState(10);
  const [years, setYears] = useState(3);
  const [status, setStatus] = useState<string>("draft");
  const [notes, setNotes] = useState("");
  /** Khóa cơ bản đang chọn cho form tạo policy mới */
  const [newPolicyBaseIds, setNewPolicyBaseIds] = useState<Set<string>>(new Set());
  /** Khóa cơ bản khi sửa chi tiết */
  const [editBaseIds, setEditBaseIds] = useState<Set<string>>(new Set());
  const [createProgramId, setCreateProgramId] = useState("");
  const [createBaseId, setCreateBaseId] = useState("");
  const [editProgramId, setEditProgramId] = useState("");
  const [editBaseId, setEditBaseId] = useState("");
  const [saving, setSaving] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    policy: Record<string, unknown>;
    base_course_ids: string[];
    entitlements: EntRow[];
  } | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    setWarning(null);
    setLoading(true);
    try {
      const prRes = await fetch("/api/owner/org-domain-programs", {
        credentials: "same-origin",
      });
      const pr = await prRes.json();
      if (!prRes.ok) {
        throw new Error(pr.error || `Không tải được chương trình (${prRes.status})`);
      }
      if (!Array.isArray(pr.programs)) {
        throw new Error(pr.error || "Phản hồi chương trình không hợp lệ");
      }
      setPrograms(pr.programs);

      const plRes = await fetch("/api/owner/org-domain-policies", {
        credentials: "same-origin",
      });
      const pl = await plRes.json();
      if (!plRes.ok) {
        if (isOrgDomainSchemaMissingResponse(plRes, pl)) {
          setPolicies([]);
          setWarning(typeof pl.error === "string" ? pl.error : "");
          return;
        }
        throw new Error(pl.error || `Không tải được policy (${plRes.status})`);
      }
      if (!Array.isArray(pl.policies)) {
        throw new Error(pl.error || "Phản hồi policy không hợp lệ");
      }
      setPolicies(pl.policies);
      if (typeof pl.warning === "string" && pl.warning.trim()) {
        setWarning(pl.warning.trim());
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createProgram = useMemo(
    () => (createProgramId ? programs.find((p) => p.id === createProgramId) ?? null : null),
    [programs, createProgramId]
  );
  const editProgram = useMemo(
    () => (editProgramId ? programs.find((p) => p.id === editProgramId) ?? null : null),
    [programs, editProgramId]
  );

  const newSelectedRows = useMemo(() => {
    const rows: { id: string; programName: string; label: string }[] = [];
    for (const prog of programs) {
      for (const b of prog.base_courses) {
        if (newPolicyBaseIds.has(b.id)) {
          rows.push({ id: b.id, programName: prog.name, label: `${b.name} (${b.code})` });
        }
      }
    }
    rows.sort(
      (a, b) =>
        a.programName.localeCompare(b.programName, "vi") || a.label.localeCompare(b.label, "vi")
    );
    return rows;
  }, [programs, newPolicyBaseIds]);

  const editSelectedRows = useMemo(() => {
    const rows: { id: string; programName: string; label: string }[] = [];
    for (const prog of programs) {
      for (const b of prog.base_courses) {
        if (editBaseIds.has(b.id)) {
          rows.push({ id: b.id, programName: prog.name, label: `${b.name} (${b.code})` });
        }
      }
    }
    rows.sort(
      (a, b) =>
        a.programName.localeCompare(b.programName, "vi") || a.label.localeCompare(b.label, "vi")
    );
    return rows;
  }, [programs, editBaseIds]);

  function addPickedToNew() {
    if (!createBaseId) return;
    setNewPolicyBaseIds((prev) => new Set(prev).add(createBaseId));
    setCreateBaseId("");
  }

  function addAllBasesInCreateProgram() {
    if (!createProgram) return;
    setNewPolicyBaseIds((prev) => {
      const n = new Set(prev);
      for (const b of createProgram.base_courses) n.add(b.id);
      return n;
    });
  }

  function removeNewBase(id: string) {
    setNewPolicyBaseIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }

  function addPickedToEdit() {
    if (!editBaseId) return;
    setEditBaseIds((prev) => new Set(prev).add(editBaseId));
    setEditBaseId("");
  }

  function addAllBasesInEditProgram() {
    if (!editProgram) return;
    setEditBaseIds((prev) => {
      const n = new Set(prev);
      for (const b of editProgram.base_courses) n.add(b.id);
      return n;
    });
  }

  function removeEditBase(id: string) {
    setEditBaseIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const base_course_ids = [...newPolicyBaseIds];
      if (!domain.trim() || base_course_ids.length === 0) {
        setErr("Nhập tên miền và chọn ít nhất một khóa học cơ bản.");
        setSaving(false);
        return;
      }
      const res = await fetch("/api/owner/org-domain-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email_domain: domain.trim().toLowerCase(),
          max_users: maxUsers,
          unused_expiry_years: years,
          status,
          notes: notes.trim() || null,
          base_course_ids,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (isOrgDomainSchemaMissingResponse(res, j)) {
          setWarning(typeof j.error === "string" ? j.error : "");
          return;
        }
        throw new Error(j.error || "Tạo thất bại");
      }
      setDomain("");
      setNewPolicyBaseIds(new Set());
      setCreateProgramId("");
      setCreateBaseId("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(id: string) {
    setDetailId(id);
    setDetail(null);
    const res = await fetch(`/api/owner/org-domain-policies/${id}`);
    const j = await res.json();
    if (!res.ok) {
      if (isOrgDomainSchemaMissingResponse(res, j)) {
        setWarning(typeof j.error === "string" ? j.error : "");
        return;
      }
      setErr(j.error || "Không tải chi tiết");
      return;
    }
    const baseIds = j.base_course_ids ?? [];
    setDetail({
      policy: j.policy,
      base_course_ids: baseIds,
      entitlements: j.entitlements ?? [],
    });
    setEditBaseIds(new Set(baseIds));
    setEditProgramId("");
    setEditBaseId("");
    setDomain((j.policy as { email_domain: string }).email_domain);
    setMaxUsers((j.policy as { max_users: number }).max_users);
    setYears((j.policy as { unused_expiry_years: number }).unused_expiry_years);
    setStatus(String((j.policy as { status: string }).status ?? "draft"));
    setNotes(String((j.policy as { notes?: string | null }).notes ?? ""));
  }

  async function saveDetail() {
    if (!detailId) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/org-domain-policies/${detailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          max_users: maxUsers,
          unused_expiry_years: years,
          notes: notes.trim() || null,
          base_course_ids: [...editBaseIds],
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (isOrgDomainSchemaMissingResponse(res, j)) {
          setWarning(typeof j.error === "string" ? j.error : "");
          return;
        }
        throw new Error(j.error || "Lưu thất bại");
      }
      await load();
      await openDetail(detailId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  async function patchEntitlement(entId: string, body: Record<string, unknown>) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/org-domain-entitlements/${entId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        if (isOrgDomainSchemaMissingResponse(res, j)) {
          setWarning(typeof j.error === "string" ? j.error : "");
          return;
        }
        throw new Error(j.error || "Cập nhật thất bại");
      }
      if (detailId) await openDetail(detailId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSaving(false);
    }
  }

  if (loading && policies.length === 0) {
    return <p className="text-gray-400">Đang tải…</p>;
  }

  return (
    <div className="space-y-10">
      {err && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
        </div>
      )}
      {warning && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {warning}
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-[#D4AF37]">Tạo policy theo tên miền</h2>
        <p className="mt-1 text-sm text-gray-400">
          Chọn <strong className="text-gray-200">chương trình</strong> và <strong className="text-gray-200">khóa cơ bản</strong>{" "}
          từ dropdown, bấm <strong className="text-gray-200">Thêm</strong> (hoặc thêm cả chương trình). Danh sách bên dưới
          là những gì đã chọn. Miễn phí áp theo base course — mọi khóa thường cùng base vẫn được miễn phí trong thời hạn.
        </p>
        <form onSubmit={handleCreate} className="mt-4 space-y-4 max-w-3xl">
          <div>
            <label className="block text-sm text-gray-400">Tên miền email (sau @)</label>
            <input
              className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
              placeholder="vidu.com.vn"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm text-gray-400">Số suất tối đa (không thu hồi)</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
                value={maxUsers}
                onChange={(e) => setMaxUsers(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400">Năm — hết hạn nếu chưa dùng (A)</label>
              <input
                type="number"
                min={1}
                max={50}
                className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Trạng thái</label>
            <select
              className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Nháp</option>
              <option value="active">Kích hoạt</option>
              <option value="suspended">Tạm dừng</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Chương trình &amp; khóa học cơ bản</label>
            {programs.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Chưa có chương trình hoặc khóa cơ bản trong hệ thống.</p>
            ) : (
              <div className="mt-2 space-y-3 rounded border border-white/10 p-3 text-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                  <div className="min-w-[200px] flex-1">
                    <label className="block text-xs text-gray-500">Chương trình</label>
                    <select
                      className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
                      value={createProgramId}
                      onChange={(e) => {
                        setCreateProgramId(e.target.value);
                        setCreateBaseId("");
                      }}
                    >
                      <option value="">— Chọn chương trình —</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <label className="block text-xs text-gray-500">Khóa học cơ bản</label>
                    <select
                      className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white disabled:opacity-40"
                      value={createBaseId}
                      disabled={!createProgram}
                      onChange={(e) => setCreateBaseId(e.target.value)}
                    >
                      <option value="">— Chọn khóa —</option>
                      {(createProgram?.base_courses ?? []).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={addPickedToNew}
                    disabled={!createBaseId}
                    className="rounded border border-[#D4AF37]/60 px-4 py-2 text-sm text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-40"
                  >
                    Thêm
                  </button>
                  <button
                    type="button"
                    onClick={addAllBasesInCreateProgram}
                    disabled={!createProgram || (createProgram.base_courses?.length ?? 0) === 0}
                    className="rounded border border-white/25 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40"
                  >
                    Thêm tất cả trong chương trình
                  </button>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500">Đã chọn ({newPolicyBaseIds.size})</div>
                  {newSelectedRows.length === 0 ? (
                    <p className="mt-1 text-xs text-gray-600">Chưa có mục nào — chọn từ dropdown và bấm Thêm.</p>
                  ) : (
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-white/5 p-2">
                      {newSelectedRows.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-start justify-between gap-2 text-xs sm:text-sm"
                        >
                          <span>
                            <span className="text-[#D4AF37]/90">{row.programName}</span>
                            <span className="text-gray-500"> — </span>
                            <span className="text-gray-200">{row.label}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeNewBase(row.id)}
                            className="shrink-0 text-red-300/90 hover:underline"
                          >
                            Xóa
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-400">Ghi chú</label>
            <textarea
              className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {saving ? "Đang lưu…" : "Tạo policy"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#D4AF37]">Danh sách policy</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Người dùng đúng tên miền được nhận diện khi đăng nhập và ghi danh; hệ thống tự gắn suất miễn phí khi đủ điều
          kiện — không cần đồng bộ thủ công.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="py-2 pr-3">Tên miền</th>
                <th className="py-2 pr-3">Trạng thái</th>
                <th className="py-2 pr-3 max-w-[140px]">Chương trình</th>
                <th className="py-2 pr-3 min-w-[200px]">Khóa học</th>
                <th className="py-2 pr-3 whitespace-nowrap">Thời điểm bắt đầu</th>
                <th
                  className="py-2 pr-3 whitespace-nowrap"
                  title="Mốc tham chiếu: lúc tạo policy + N năm (phương án A — hạn nếu chưa dùng suất)"
                >
                  Thời điểm kết thúc
                </th>
                <th className="py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => {
                const programsStr = (p.program_names ?? []).join(", ") || "—";
                const basesStr = (p.base_course_labels ?? []).join(", ") || "—";
                const startAt = p.created_at ? formatPolicyDate(p.created_at) : "—";
                const endRef = p.reference_end_at ? formatPolicyDate(p.reference_end_at) : "—";
                return (
                  <tr key={p.id} className="border-b border-white/5 align-top">
                    <td className="py-2 pr-3 font-mono text-white">{p.email_domain}</td>
                    <td className="py-2 pr-3">{statusLabelVi(p.status)}</td>
                    <td className="py-2 pr-3 text-gray-300 max-w-[140px] break-words" title={programsStr}>
                      {programsStr}
                    </td>
                    <td className="py-2 pr-3 text-gray-300 text-xs" title={basesStr}>
                      {basesStr}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-300">{startAt}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-gray-300">{endRef}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => void openDetail(p.id)}
                        className="text-[#D4AF37] hover:underline"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {detail && detailId && (
        <section className="rounded-xl border border-white/10 p-6">
          <h2 className="text-lg font-semibold text-[#D4AF37]">Chi tiết &amp; chỉnh sửa</h2>
          <p className="mt-1 text-sm text-gray-400">Domain: {(detail.policy as { email_domain: string }).email_domain}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 max-w-xl">
          <div>
            <label className="text-sm text-gray-400">Trạng thái</label>
            <select
              className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="draft">Nháp</option>
              <option value="active">Kích hoạt</option>
              <option value="suspended">Tạm dừng</option>
            </select>
          </div>
            <div>
              <label className="text-sm text-gray-400">max_users</label>
              <input
                type="number"
                className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
                value={maxUsers}
                onChange={(e) => setMaxUsers(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">unused_expiry_years (suất mới)</label>
              <input
                type="number"
                className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Chọn chương trình và khóa cơ bản từ dropdown, thêm vào danh sách như khi tạo mới. Lưu để cập nhật.
          </p>
          {programs.length > 0 && (
            <div className="mt-2 max-w-3xl space-y-3 rounded border border-white/10 p-3 text-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-[200px] flex-1">
                  <label className="block text-xs text-gray-500">Chương trình</label>
                  <select
                    className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
                    value={editProgramId}
                    onChange={(e) => {
                      setEditProgramId(e.target.value);
                      setEditBaseId("");
                    }}
                  >
                    <option value="">— Chọn chương trình —</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[220px] flex-1">
                  <label className="block text-xs text-gray-500">Khóa học cơ bản</label>
                  <select
                    className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white disabled:opacity-40"
                    value={editBaseId}
                    disabled={!editProgram}
                    onChange={(e) => setEditBaseId(e.target.value)}
                  >
                    <option value="">— Chọn khóa —</option>
                    {(editProgram?.base_courses ?? []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addPickedToEdit}
                  disabled={!editBaseId}
                  className="rounded border border-[#D4AF37]/60 px-4 py-2 text-sm text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-40"
                >
                  Thêm
                </button>
                <button
                  type="button"
                  onClick={addAllBasesInEditProgram}
                  disabled={!editProgram || (editProgram.base_courses?.length ?? 0) === 0}
                  className="rounded border border-white/25 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40"
                >
                  Thêm tất cả trong chương trình
                </button>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">Đang áp dụng ({editBaseIds.size})</div>
                {editSelectedRows.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-600">Chưa chọn khóa nào — cần ít nhất một khóa cơ bản để lưu.</p>
                ) : (
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded border border-white/5 p-2">
                    {editSelectedRows.map((row) => (
                      <li
                        key={row.id}
                        className="flex items-start justify-between gap-2 text-xs sm:text-sm"
                      >
                        <span>
                          <span className="text-[#D4AF37]/90">{row.programName}</span>
                          <span className="text-gray-500"> — </span>
                          <span className="text-gray-200">{row.label}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeEditBase(row.id)}
                          className="shrink-0 text-red-300/90 hover:underline"
                        >
                          Xóa
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void saveDetail()}
            disabled={saving}
            className="mt-4 rounded-full bg-[#D4AF37] px-6 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            Lưu thay đổi
          </button>

          <h3 className="mt-8 text-base font-semibold text-white">Suất đã cấp</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-white/10 text-gray-400">
                  <th className="py-2">Email</th>
                  <th className="py-2">Cấp</th>
                  <th className="py-2">Dùng lần đầu</th>
                  <th className="py-2">Hạn (chưa dùng)</th>
                  <th className="py-2">Thu hồi</th>
                  <th className="py-2">Gia hạn hạn</th>
                </tr>
              </thead>
              <tbody>
                {detail.entitlements.map((e) => (
                  <tr key={e.id} className="border-b border-white/5">
                    <td className="py-2 font-mono">{e.email ?? e.user_id.slice(0, 8)}</td>
                    <td className="py-2">{new Date(e.granted_at).toLocaleString("vi-VN")}</td>
                    <td className="py-2">
                      {e.first_used_at ? new Date(e.first_used_at).toLocaleString("vi-VN") : "—"}
                    </td>
                    <td className="py-2">{new Date(e.unused_expiry_deadline).toLocaleString("vi-VN")}</td>
                    <td className="py-2">
                      {e.revoked_at ? (
                        "Đã thu hồi"
                      ) : (
                        <button
                          type="button"
                          className="text-red-300 hover:underline"
                          onClick={() => {
                            if (confirm("Thu hồi quyền miễn phí cho user này?")) {
                              void patchEntitlement(e.id, { revoke: true, revoke_reason: "Owner thu hồi" });
                            }
                          }}
                        >
                          Thu hồi
                        </button>
                      )}
                    </td>
                    <td className="py-2">
                      {!e.revoked_at && !e.first_used_at && (
                        <button
                          type="button"
                          className="text-[#D4AF37] hover:underline"
                          onClick={() => {
                            const v = prompt("Ngày-giờ hạn mới (ISO), vd 2027-12-31T23:59:59+07:00");
                            if (v) void patchEntitlement(e.id, { unused_expiry_deadline: v });
                          }}
                        >
                          Gia hạn
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
