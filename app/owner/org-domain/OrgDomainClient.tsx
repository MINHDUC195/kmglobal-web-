"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ORG_DOMAIN_SCHEMA_MISSING_CODE } from "@/lib/org-domain-schema-error";

function isOrgDomainSchemaMissingResponse(res: Response, body: { code?: string }) {
  return res.status === 503 && body.code === ORG_DOMAIN_SCHEMA_MISSING_CODE;
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

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const selectedProgram = useMemo(
    () => programs.find((p) => p.id === selectedProgramId) ?? null,
    [programs, selectedProgramId]
  );

  const [domain, setDomain] = useState("");
  const [maxUsers, setMaxUsers] = useState(10);
  const [years, setYears] = useState(3);
  const [status, setStatus] = useState<string>("draft");
  const [notes, setNotes] = useState("");
  const [selectedBaseIds, setSelectedBaseIds] = useState<Set<string>>(new Set());
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

  function toggleBase(id: string) {
    setSelectedBaseIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function selectAllInProgram() {
    if (!selectedProgram) return;
    setSelectedBaseIds(new Set(selectedProgram.base_courses.map((b) => b.id)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const base_course_ids = [...selectedBaseIds];
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
      setSelectedBaseIds(new Set());
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
    setSelectedBaseIds(new Set(baseIds));
    setDomain((j.policy as { email_domain: string }).email_domain);
    setMaxUsers((j.policy as { max_users: number }).max_users);
    setYears((j.policy as { unused_expiry_years: number }).unused_expiry_years);
    setStatus(String((j.policy as { status: string }).status ?? "draft"));
    setNotes(String((j.policy as { notes?: string | null }).notes ?? ""));
    const firstBase = baseIds[0] as string | undefined;
    if (firstBase && programs.length) {
      const prog = programs.find((p) => p.base_courses.some((b) => b.id === firstBase));
      if (prog) setSelectedProgramId(prog.id);
    }
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
          base_course_ids: [...selectedBaseIds],
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

  async function syncUsers(policyId: string) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/owner/org-domain-policies/${policyId}/sync-users`, {
        method: "POST",
      });
      const j = await res.json();
      if (!res.ok) {
        if (isOrgDomainSchemaMissingResponse(res, j)) {
          setWarning(typeof j.error === "string" ? j.error : "");
          return;
        }
        throw new Error(j.error || "Đồng bộ thất bại");
      }
      alert(`Đã cấp thêm ${j.assigned ?? 0} suất (user đã xác nhận email).`);
      await load();
      if (detailId === policyId) await openDetail(policyId);
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
          Chọn chương trình → tick khóa học cơ bản (hoặc &quot;Chọn tất cả trong chương trình&quot;). Miễn phí áp
          theo <strong className="text-gray-200">base course</strong> — mọi khóa thường (regular) cùng base vẫn được
          miễn phí trong thời hạn.
        </p>
        <form onSubmit={handleCreate} className="mt-4 space-y-4 max-w-xl">
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
            <label className="block text-sm text-gray-400">Chương trình (lọc)</label>
            <select
              className="mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-white"
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
            >
              <option value="">— Chọn chương trình —</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {selectedProgram && (
            <div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllInProgram}
                  className="rounded border border-[#D4AF37]/50 px-3 py-1.5 text-sm text-[#D4AF37] hover:bg-[#D4AF37]/10"
                >
                  Chọn tất cả trong chương trình
                </button>
              </div>
              <ul className="mt-2 max-h-48 overflow-y-auto rounded border border-white/10 p-2">
                {selectedProgram.base_courses.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 py-1 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedBaseIds.has(b.id)}
                      onChange={() => toggleBase(b.id)}
                    />
                    <span>
                      {b.name}{" "}
                      <span className="text-gray-500">({b.code})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400">
                <th className="py-2 pr-4">Tên miền</th>
                <th className="py-2 pr-4">Trạng thái</th>
                <th className="py-2 pr-4">Suất</th>
                <th className="py-2 pr-4">Năm (A)</th>
                <th className="py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-2 pr-4 font-mono text-white">{p.email_domain}</td>
                  <td className="py-2 pr-4">{p.status}</td>
                  <td className="py-2 pr-4">
                    {p.seats_used} / {p.max_users}
                  </td>
                  <td className="py-2 pr-4">{p.unused_expiry_years}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => void openDetail(p.id)}
                      className="text-[#D4AF37] hover:underline"
                    >
                      Chi tiết
                    </button>
                    {p.status === "active" && (
                      <button
                        type="button"
                        onClick={() => void syncUsers(p.id)}
                        className="ml-3 text-gray-300 hover:underline"
                      >
                        Đồng bộ user
                      </button>
                    )}
                  </td>
                </tr>
              ))}
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
            Chọn khóa cơ bản (theo từng chương trình). Lưu để cập nhật.
          </p>
          <div className="mt-2 max-h-64 space-y-4 overflow-y-auto rounded border border-white/10 p-3 text-sm">
            {programs.map((prog) => (
              <div key={prog.id}>
                <div className="font-medium text-gray-300">{prog.name}</div>
                <ul className="mt-1 pl-2">
                  {prog.base_courses.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedBaseIds.has(b.id)}
                        onChange={() => toggleBase(b.id)}
                      />
                      {b.name}{" "}
                      <span className="text-gray-500">({b.code})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
