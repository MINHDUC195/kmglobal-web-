"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Program = {
  id: string;
  name: string;
  code: string | null;
  note: string | null;
  created_at?: string;
  approval_status?: "draft" | "pending" | "approved" | null;
};

export default function AdminProgramsList({ programs }: { programs: Program[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState<Program | null>(null);

  const approved = (programs ?? []).filter(
    (p) => (p.approval_status ?? "draft") === "approved"
  );
  const inDevelopment = (programs ?? []).filter(
    (p) => (p.approval_status ?? "draft") !== "approved"
  );

  async function handleSubmit(programId: string) {
    if (submitting) return;
    setSubmitting(programId);
    setConfirmSubmit(null);
    try {
      const res = await fetch(`/api/admin/programs/${programId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setSubmitting(null);
    }
  }

  function ProgramRow({
    p,
    showSubmit,
  }: {
    p: Program;
    showSubmit: boolean;
  }) {
    return (
      <tr className="text-gray-300">
        <td className="px-4 py-3">{p.name}</td>
        <td className="px-4 py-3">{p.code || "-"}</td>
        <td className="px-4 py-3">{p.note || "-"}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/programs/${p.id}`}
            className="font-medium text-[#D4AF37] hover:underline"
          >
            Chi tiết
          </Link>
          {showSubmit && (
            <button
              type="button"
              onClick={() => setConfirmSubmit(p)}
              disabled={submitting === p.id}
              className="rounded-lg border border-amber-500/60 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
            >
              {submitting === p.id ? "Đang gửi..." : "Đề xuất phê duyệt"}
            </button>
          )}
          {(p.approval_status ?? "draft") === "pending" && (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
              Chờ phê duyệt
            </span>
          )}
          </div>
        </td>
      </tr>
    );
  }

  function ProgramCard({
    p,
    showSubmit,
  }: {
    p: Program;
    showSubmit: boolean;
  }) {
    return (
      <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="text-sm font-semibold text-white">{p.name}</p>
        <p className="mt-1 text-xs text-gray-400">Mã quản lý: {p.code || "-"}</p>
        <p className="mt-1 text-xs text-gray-400">Ghi chú: {p.note || "-"}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/programs/${p.id}`}
            className="font-medium text-[#D4AF37] hover:underline"
          >
            Chi tiết
          </Link>
          {showSubmit && (
            <button
              type="button"
              onClick={() => setConfirmSubmit(p)}
              disabled={submitting === p.id}
              className="rounded-lg border border-amber-500/60 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
            >
              {submitting === p.id ? "Đang gửi..." : "Đề xuất phê duyệt"}
            </button>
          )}
          {(p.approval_status ?? "draft") === "pending" && (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
              Chờ phê duyệt
            </span>
          )}
        </div>
      </article>
    );
  }

  return (
    <>
      {approved.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-white">
            Chương trình đã phê duyệt
          </h2>
          <div className="space-y-3 md:hidden">
            {approved.map((p) => (
              <ProgramCard key={p.id} p={p} showSubmit={false} />
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-white/10 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/5">
                <tr>
                  <th className="px-4 py-3 font-semibold text-white">Tên chương trình</th>
                  <th className="px-4 py-3 font-semibold text-white">Mã quản lý</th>
                  <th className="px-4 py-3 font-semibold text-white">Ghi chú</th>
                  <th className="px-4 py-3 font-semibold text-white">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {approved.map((p) => (
                  <ProgramRow key={p.id} p={p} showSubmit={false} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">
          Chương trình đang phát triển
        </h2>
        {inDevelopment.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-gray-400">
            Chưa có chương trình đang phát triển. Nhấn &quot;Thêm chương trình&quot; để tạo mới.
          </div>
        ) : (
          <div className="space-y-3 md:hidden">
            {inDevelopment.map((p) => (
              <ProgramCard
                key={p.id}
                p={p}
                showSubmit={(p.approval_status ?? "draft") === "draft"}
              />
            ))}
          </div>
        )}
        <div className="hidden overflow-hidden rounded-xl border border-white/10 md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-4 py-3 font-semibold text-white">Tên chương trình</th>
                <th className="px-4 py-3 font-semibold text-white">Mã quản lý</th>
                <th className="px-4 py-3 font-semibold text-white">Ghi chú</th>
                <th className="px-4 py-3 font-semibold text-white">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {inDevelopment.length ? (
                inDevelopment.map((p) => (
                  <ProgramRow
                    key={p.id}
                    p={p}
                    showSubmit={(p.approval_status ?? "draft") === "draft"}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Chưa có chương trình đang phát triển. Nhấn &quot;Thêm chương trình&quot; để tạo mới.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {confirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a1628] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#D4AF37]">Xác nhận đề xuất phê duyệt</h3>
            <p className="mt-3 text-sm text-gray-300">
              Bạn có chắc muốn đề xuất phê duyệt chương trình <strong className="text-white">{confirmSubmit.name}</strong>?
              Sau khi gửi, chương trình sẽ chuyển sang trạng thái chờ owner phê duyệt.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmSubmit(null)}
                disabled={submitting === confirmSubmit.id}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => handleSubmit(confirmSubmit.id)}
                disabled={submitting === confirmSubmit.id}
                className="flex-1 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-50"
              >
                {submitting === confirmSubmit.id ? "Đang gửi..." : "Đồng ý"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
