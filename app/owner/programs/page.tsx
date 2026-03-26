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

const PAGE_SIZE = 10;

export default function OwnerProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [pendingPage, setPendingPage] = useState(1);
  const [approvedPage, setApprovedPage] = useState(1);

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
  const pendingTotalPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const approvedTotalPages = Math.max(1, Math.ceil(approved.length / PAGE_SIZE));
  const pendingSlice = pending.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE);
  const approvedSlice = approved.slice((approvedPage - 1) * PAGE_SIZE, approvedPage * PAGE_SIZE);

  useEffect(() => {
    if (pendingPage > pendingTotalPages) setPendingPage(pendingTotalPages);
  }, [pendingPage, pendingTotalPages]);

  useEffect(() => {
    if (approvedPage > approvedTotalPages) setApprovedPage(approvedTotalPages);
  }, [approvedPage, approvedTotalPages]);

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
                      {pendingSlice.map((p) => (
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
                {pending.length > PAGE_SIZE && (
                  <div className="mt-3 flex items-center justify-between text-sm text-gray-400">
                    <span>
                      Trang {pendingPage}/{pendingTotalPages} · Tổng {pending.length} mục
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                        disabled={pendingPage <= 1}
                        className="rounded border border-white/20 px-3 py-1 disabled:opacity-40"
                      >
                        ← Trước
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingPage((p) => Math.min(pendingTotalPages, p + 1))}
                        disabled={pendingPage >= pendingTotalPages}
                        className="rounded border border-white/20 px-3 py-1 disabled:opacity-40"
                      >
                        Sau →
                      </button>
                    </div>
                  </div>
                )}
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
                      approvedSlice.map((p) => (
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
              {approved.length > PAGE_SIZE && (
                <div className="mt-3 flex items-center justify-between text-sm text-gray-400">
                  <span>
                    Trang {approvedPage}/{approvedTotalPages} · Tổng {approved.length} mục
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setApprovedPage((p) => Math.max(1, p - 1))}
                      disabled={approvedPage <= 1}
                      className="rounded border border-white/20 px-3 py-1 disabled:opacity-40"
                    >
                      ← Trước
                    </button>
                    <button
                      type="button"
                      onClick={() => setApprovedPage((p) => Math.min(approvedTotalPages, p + 1))}
                      disabled={approvedPage >= approvedTotalPages}
                      className="rounded border border-white/20 px-3 py-1 disabled:opacity-40"
                    >
                      Sau →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
