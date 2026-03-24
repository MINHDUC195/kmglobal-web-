"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type BaseCourse = {
  id: string;
  code: string;
  name: string;
  summary?: string | null;
  difficulty_level?: string | null;
};

export default function ProgramBaseCoursesTable({
  baseCourses,
  isApproved,
}: {
  baseCourses: BaseCourse[];
  isApproved: boolean;
}) {
  const router = useRouter();
  const [improveTarget, setImproveTarget] = useState<BaseCourse | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleImprove() {
    if (!improveTarget) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/programs/improve-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseCourseId: improveTarget.id,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setImproveTarget(null);
        setReason("");
        router.refresh();
        if (data.newProgramId) {
          router.push(`/admin/programs/${data.newProgramId}`);
        }
      } else {
        setError(data.error || "Không thể cải tiến khóa học.");
      }
    } catch {
      setError("Không thể kết nối.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3 font-semibold text-white">Mã</th>
              <th className="px-4 py-3 font-semibold text-white">Tên</th>
              <th className="px-4 py-3 font-semibold text-white">Độ khó</th>
              <th className="px-4 py-3 font-semibold text-white">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {baseCourses?.length ? (
              baseCourses.map((c) => (
                <tr key={c.id} className="text-gray-300">
                  <td className="px-4 py-3">{c.code}</td>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">{c.difficulty_level || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/base-courses/${c.id}`}
                        className="font-medium text-[#D4AF37] hover:underline"
                      >
                        Chi tiết
                      </Link>
                      {isApproved && (
                        <button
                          type="button"
                          onClick={() => {
                            setImproveTarget(c);
                            setReason("");
                            setError("");
                          }}
                          className="rounded-lg border border-amber-500/60 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
                        >
                          Cải tiến khóa học
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Chưa có khóa học cơ bản. Nhấn &quot;Thêm khóa học cơ bản&quot; để tạo mới.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {improveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0a1628] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[#D4AF37]">Xác nhận cải tiến khóa học</h3>
            <p className="mt-2 text-sm text-gray-300">
              Khóa học <strong className="text-white">{improveTarget.name}</strong> ({improveTarget.code}) sẽ được nhân bản
              thành phiên bản cải tiến với mã Rev mới, xuất hiện trong chương trình đang phát triển.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-300">Lý do cải tiến</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập lý do cải tiến (bắt buộc)"
                className="w-full rounded-lg border border-white/15 bg-[#0b1323] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]"
                rows={3}
              />
            </div>
            {error && (
              <p className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setImproveTarget(null);
                  setReason("");
                  setError("");
                }}
                disabled={submitting}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleImprove}
                disabled={submitting || !reason.trim()}
                className="flex-1 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Đang xử lý..." : "Đồng ý"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
