"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Program = {
  id: string;
  name: string;
  code: string | null;
  note: string | null;
  approval_status?: "draft" | "pending" | "approved" | null;
};

export default function OwnerProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  async function loadPrograms() {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/programs");
      const data = await res.json();
      if (res.ok) setPrograms(data.programs ?? []);
    } catch {
      setPrograms([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPrograms();
  }, []);

  async function handleApprove(id: string) {
    if (actioning) return;
    setActioning(id);
    try {
      const res = await fetch(`/api/owner/programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) void loadPrograms();
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(id: string) {
    if (actioning) return;
    setActioning(id);
    try {
      const res = await fetch(`/api/owner/programs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (res.ok) void loadPrograms();
    } finally {
      setActioning(null);
    }
  }

  async function handleDelete(id: string) {
    if (actioning || !confirm("Xóa chương trình này? Hành động không thể hoàn tác.")) return;
    setActioning(id);
    try {
      const res = await fetch(`/api/owner/programs/${id}`, { method: "DELETE" });
      if (res.ok) void loadPrograms();
    } finally {
      setActioning(null);
    }
  }

  const pending = programs.filter((p) => (p.approval_status ?? "draft") === "pending");
  const approved = programs.filter((p) => (p.approval_status ?? "draft") === "approved");

  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <Link href="/owner" className="text-sm text-gray-400 hover:text-[#D4AF37]">
          ← Dashboard Owner
        </Link>
      </div>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Quản lý chương trình
      </h1>
      <p className="mt-2 text-gray-400">
        Phê duyệt chương trình đang chờ, xóa chương trình đã phê duyệt.
      </p>

      <div className="mt-8 space-y-8">
        {loading ? (
          <p className="text-gray-500">Đang tải...</p>
        ) : (
          <>
            {pending.length > 0 && (
              <div>
                <h2 className="mb-3 text-lg font-semibold text-amber-300">
                  Chương trình chờ phê duyệt
                </h2>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-white/10 bg-white/5">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-white">Tên</th>
                        <th className="px-4 py-3 font-semibold text-white">Mã</th>
                        <th className="px-4 py-3 font-semibold text-white">Ghi chú</th>
                        <th className="px-4 py-3 font-semibold text-white">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {pending.map((p) => (
                        <tr key={p.id} className="text-gray-300">
                          <td className="px-4 py-3">{p.name}</td>
                          <td className="px-4 py-3">{p.code || "-"}</td>
                          <td className="px-4 py-3">{p.note || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Link
                                href={`/admin/programs/${p.id}`}
                                className="text-[#D4AF37] hover:underline"
                              >
                                Chi tiết
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleApprove(p.id)}
                                disabled={actioning === p.id}
                                className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Phê duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(p.id)}
                                disabled={actioning === p.id}
                                className="rounded bg-gray-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                              >
                                Từ chối
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <h2 className="mb-3 text-lg font-semibold text-white">
                Chương trình đã phê duyệt
              </h2>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/5">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-white">Tên</th>
                      <th className="px-4 py-3 font-semibold text-white">Mã</th>
                      <th className="px-4 py-3 font-semibold text-white">Ghi chú</th>
                      <th className="px-4 py-3 font-semibold text-white">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {approved.length ? (
                      approved.map((p) => (
                        <tr key={p.id} className="text-gray-300">
                          <td className="px-4 py-3">{p.name}</td>
                          <td className="px-4 py-3">{p.code || "-"}</td>
                          <td className="px-4 py-3">{p.note || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Link
                                href={`/admin/programs/${p.id}`}
                                className="text-[#D4AF37] hover:underline"
                              >
                                Chi tiết
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(p.id)}
                                disabled={actioning === p.id}
                                className="rounded bg-red-600/80 px-2.5 py-1 text-xs font-medium text-red-200 hover:bg-red-600 disabled:opacity-50"
                              >
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                          Chưa có chương trình đã phê duyệt.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
