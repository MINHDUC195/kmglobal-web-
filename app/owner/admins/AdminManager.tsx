"use client";

import { FormEvent, useEffect, useState } from "react";
import { validatePasswordStrength } from "@/lib/password-policy";

type Admin = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  id_card: string | null;
  can_edit_content: boolean | null;
  role: string | null;
  created_at: string;
  editable_program_ids?: string[];
};

type Program = { id: string; name: string; code: string | null };

export default function AdminManager() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editing, setEditing] = useState<Admin | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editIdCard, setEditIdCard] = useState("");
  const [editEditableProgramIds, setEditEditableProgramIds] = useState<string[]>([]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [idCard, setIdCard] = useState("");
  const [editableProgramIds, setEditableProgramIds] = useState<string[]>([]);
  const [showProgramDropdown, setShowProgramDropdown] = useState(false);
  const [showEditProgramDropdown, setShowEditProgramDropdown] = useState(false);

  async function loadAdmins() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/owner/admins");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không tải được");
      setAdmins(data.admins ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setLoading(false);
    }
  }

  async function loadPrograms() {
    try {
      const res = await fetch("/api/owner/programs");
      const data = await res.json();
      if (res.ok) setPrograms(data.programs ?? []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void loadAdmins();
    void loadPrograms();
  }, []);

  function toggleProgram(id: string, selected: string[], setSelected: (v: string[]) => void) {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
    } else {
      setSelected([...selected, id]);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!email.trim()) {
      setError("Email là bắt buộc");
      return;
    }
    const pwRes = validatePasswordStrength(password);
    if (!pwRes.ok) {
      setError(pwRes.message ?? "Mật khẩu không đủ mạnh.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/owner/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim() || undefined,
          phone: phone.trim() || undefined,
          company: company.trim() || undefined,
          id_card: idCard.trim() || undefined,
          editable_program_ids: editableProgramIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Thêm thất bại");
      if (data.requiresConfirmation) {
        setSuccess(
          `Đã tạo admin thành công. Email xác nhận đã gửi tới ${data.email}. ` +
          `Vui lòng chuyển mật khẩu bạn vừa nhập cho admin qua kênh an toàn. ` +
          `Admin cần click link trong email → xác nhận điều khoản → đăng nhập.`
        );
      } else {
        setSuccess("Đã thêm admin thành công.");
      }
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");
      setCompany("");
      setIdCard("");
      setEditableProgramIds([]);
      setShowForm(false);
      void loadAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setSubmitting(false);
    }
  }

  function openEditModal(a: Admin) {
    setEditing(a);
    setEditFullName(a.full_name ?? "");
    setEditPhone(a.phone ?? "");
    setEditCompany(a.company ?? "");
    setEditIdCard(a.id_card ?? "");
    setEditEditableProgramIds(a.editable_program_ids ?? []);
    setError("");
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/owner/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editing.id,
          full_name: editFullName.trim() || undefined,
          phone: editPhone.trim() || undefined,
          company: editCompany.trim() || undefined,
          id_card: editIdCard.trim() || undefined,
          editable_program_ids: editEditableProgramIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cập nhật thất bại");
      setSuccess("Đã cập nhật thành công.");
      setEditing(null);
      void loadAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    }
  }

  async function handleDelete(a: Admin) {
    if (!confirm(`Xóa admin ${a.email}? Tài khoản sẽ bị xóa vĩnh viễn.`)) return;
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/owner/admins?userId=${encodeURIComponent(a.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xóa thất bại");
      setSuccess("Đã xóa admin thành công.");
      void loadAdmins();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {error && (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {success}
        </p>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Thêm Admin mới</h2>
        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="mt-4 rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            + Thêm Admin
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Mật khẩu <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={10}
                  placeholder="Tối thiểu 10 ký tự (hoa/thường/số)"
                  className="flex-1 rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const lower = "abcdefghjkmnpqrstuvwxyz";
                    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
                    const digits = "23456789";
                    const all = lower + upper + digits;
                    const buf = new Uint8Array(12);
                    crypto.getRandomValues(buf);
                    const chars: string[] = [
                      lower[buf[0] % lower.length],
                      upper[buf[1] % upper.length],
                      digits[buf[2] % digits.length],
                    ];
                    for (let i = 3; i < 12; i++) {
                      chars.push(all[buf[i] % all.length]);
                    }
                    for (let i = chars.length - 1; i > 0; i--) {
                      const j = buf[i % 12] % (i + 1);
                      [chars[i], chars[j]] = [chars[j], chars[i]];
                    }
                    setPassword(chars.join(""));
                  }}
                  className="shrink-0 rounded-xl border border-[#D4AF37]/60 px-4 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
                >
                  Tạo mật khẩu
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Họ tên</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white placeholder-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Số điện thoại</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901234567"
                  className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white placeholder-gray-500"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Tên đơn vị</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Công ty ABC"
                  className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white placeholder-gray-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Số CCCD</label>
                <input
                  type="text"
                  value={idCard}
                  onChange={(e) => setIdCard(e.target.value)}
                  placeholder="001234567890"
                  className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white placeholder-gray-500"
                />
              </div>
            </div>
            <div className="relative">
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Quyền soạn thảo nội dung (chọn chương trình)
              </label>
              <button
                type="button"
                onClick={() => setShowProgramDropdown(!showProgramDropdown)}
                className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-left text-white"
              >
                {editableProgramIds.length === 0
                  ? "Không chọn chương trình nào"
                  : programs
                      .filter((p) => editableProgramIds.includes(p.id))
                      .map((p) => p.name)
                      .join(", ")}
              </button>
              {showProgramDropdown && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-white/15 bg-[#0a1628] py-2">
                  {programs.length === 0 ? (
                    <p className="px-4 py-2 text-sm text-gray-500">Chưa có chương trình</p>
                  ) : (
                    programs.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-white/5"
                      >
                        <input
                          type="checkbox"
                          checked={editableProgramIds.includes(p.id)}
                          onChange={() =>
                            toggleProgram(p.id, editableProgramIds, setEditableProgramIds)
                          }
                          className="h-4 w-4 rounded border-white/30 text-[#D4AF37]"
                        />
                        <span className="text-sm text-gray-300">{p.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-60"
              >
                {submitting ? "Đang tạo..." : "Tạo Admin"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
              >
                Hủy
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg font-semibold text-white">Danh sách Admin ({admins.length})</h2>
        {loading ? (
          <p className="mt-4 text-gray-400">Đang tải...</p>
        ) : admins.length === 0 ? (
          <p className="mt-4 text-gray-500">Chưa có admin nào.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-gray-400">
                  <th className="pb-3 pr-4">Vai trò</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Họ tên</th>
                  <th className="pb-3 pr-4">Tên đơn vị</th>
                  <th className="pb-3 pr-4">SĐT</th>
                  <th className="pb-3 pr-4">CCCD</th>
                  <th className="pb-3 pr-4">Soạn nội dung</th>
                  <th className="pb-3 pr-4">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-b border-white/5">
                    <td className="py-3 pr-4">
                      <span className={a.role === "owner" ? "text-[#D4AF37]" : "text-gray-400"}>
                        {a.role === "owner" ? "Owner" : "Admin"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-white">{a.email ?? "-"}</td>
                    <td className="py-3 pr-4 text-gray-300">{a.full_name ?? "-"}</td>
                    <td className="py-3 pr-4 text-gray-300">{a.company ?? "-"}</td>
                    <td className="py-3 pr-4 text-gray-300">{a.phone ?? "-"}</td>
                    <td className="py-3 pr-4 text-gray-300">{a.id_card ?? "-"}</td>
                    <td className="max-w-[180px] py-3 pr-4">
                      {(a.editable_program_ids?.length ?? 0) > 0 ? (
                        <span className="text-xs text-emerald-400">
                          {programs
                            .filter((p) => (a.editable_program_ids ?? []).includes(p.id))
                            .map((p) => p.name)
                            .join(", ") || "—"}
                        </span>
                      ) : (
                        <span className="text-gray-500">Không</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(a)}
                          className="text-sm text-[#D4AF37] hover:underline"
                        >
                          Sửa
                        </button>
                        {a.role === "admin" && (
                          <button
                            type="button"
                            onClick={() => handleDelete(a)}
                            className="text-sm text-red-400 hover:underline"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a1628] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#D4AF37]">Sửa Admin</h3>
            <p className="mt-1 text-sm text-gray-400">{editing.email}</p>
            <form onSubmit={handleEditSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Họ tên</label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Số điện thoại</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Tên đơn vị</label>
                <input
                  type="text"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Số CCCD</label>
                <input
                  type="text"
                  value={editIdCard}
                  onChange={(e) => setEditIdCard(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white"
                />
              </div>
              <div className="relative">
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Quyền soạn thảo nội dung (chọn chương trình)
                </label>
                <button
                  type="button"
                  onClick={() => setShowEditProgramDropdown(!showEditProgramDropdown)}
                  className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-left text-white"
                >
                  {editEditableProgramIds.length === 0
                    ? "Không chọn chương trình nào"
                    : programs
                        .filter((p) => editEditableProgramIds.includes(p.id))
                        .map((p) => p.name)
                        .join(", ")}
                </button>
                {showEditProgramDropdown && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-white/15 bg-[#0a1628] py-2">
                    {programs.length === 0 ? (
                      <p className="px-4 py-2 text-sm text-gray-500">Chưa có chương trình</p>
                    ) : (
                      programs.map((p) => (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={editEditableProgramIds.includes(p.id)}
                            onChange={() =>
                              toggleProgram(p.id, editEditableProgramIds, setEditEditableProgramIds)
                            }
                            className="h-4 w-4 rounded border-white/30 text-[#D4AF37]"
                          />
                          <span className="text-sm text-gray-300">{p.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
                >
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
