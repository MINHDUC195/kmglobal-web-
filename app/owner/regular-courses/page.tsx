"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CourseRow = {
  id: string;
  name: string;
  approval_status?: string | null;
  created_at?: string | null;
  program?: { id: string; name: string } | null;
  base_course?: { id: string; name: string; code: string | null } | null;
};

const PAGE_SIZE = 10;

export default function OwnerRegularCoursesPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [pendingPage, setPendingPage] = useState(1);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/regular-courses");
      const data = await res.json();
      if (res.ok) setCourses(data.courses ?? []);
      else setCourses([]);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  async function handleApprove(id: string) {
    if (actioning) return;
    setActioning(id);
    try {
      const res = await fetch(`/api/owner/regular-courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (res.ok) void loadCourses();
    } finally {
      setActioning(null);
    }
  }

  async function handleReject(id: string) {
    if (actioning) return;
    setActioning(id);
    try {
      const res = await fetch(`/api/owner/regular-courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (res.ok) void loadCourses();
    } finally {
      setActioning(null);
    }
  }

  const pending = courses.filter((c) => (c.approval_status ?? "draft") === "pending");
  const pendingTotalPages = Math.max(1, Math.ceil(pending.length / PAGE_SIZE));
  const pendingSlice = pending.slice((pendingPage - 1) * PAGE_SIZE, pendingPage * PAGE_SIZE);

  useEffect(() => {
    if (pendingPage > pendingTotalPages) setPendingPage(pendingTotalPages);
  }, [pendingPage, pendingTotalPages]);

  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <Link href="/owner" className="text-sm text-gray-400 hover:text-[#D4AF37]">
          ← Dashboard Owner
        </Link>
      </div>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Phê duyệt khóa học thường
      </h1>
      <p className="mt-2 text-gray-400">
        Khóa nhân bản từ admin chờ duyệt trước khi hiển thị trên trang chủ, catalog và cho phép đăng ký công khai.
      </p>

      <div className="mt-8 space-y-8">
        {loading ? (
          <p className="text-gray-500">Đang tải...</p>
        ) : (
          <>
            {pending.length > 0 ? (
              <div>
                <h2 className="mb-3 text-lg font-semibold text-amber-300">Khóa học chờ phê duyệt hiển thị</h2>
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <table className="w-full text-left text-sm text-gray-200">
                    <thead className="border-b border-white/10 bg-white/5 text-xs uppercase text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Khóa học</th>
                        <th className="px-4 py-3">Chương trình / Khóa cơ bản</th>
                        <th className="px-4 py-3 w-56">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingSlice.map((c) => (
                        <tr key={c.id} className="border-b border-white/5">
                          <td className="px-4 py-3 font-medium text-white">{c.name}</td>
                          <td className="px-4 py-3 text-gray-400">
                            <div>{c.program?.name ?? "—"}</div>
                            <div className="text-xs text-gray-500">{c.base_course?.name ?? "—"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={actioning === c.id}
                                onClick={() => void handleApprove(c.id)}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                disabled={actioning === c.id}
                                onClick={() => void handleReject(c.id)}
                                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-50"
                              >
                                Từ chối
                              </button>
                              <Link
                                href={`/admin/regular-courses/${c.id}`}
                                className="inline-flex items-center rounded-lg border border-[#D4AF37]/50 px-3 py-1.5 text-xs text-[#D4AF37] hover:bg-[#D4AF37]/10"
                              >
                                Xem chi tiết
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pendingTotalPages > 1 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
                    <button
                      type="button"
                      disabled={pendingPage <= 1}
                      onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                      className="rounded border border-white/20 px-3 py-1 disabled:opacity-40"
                    >
                      Trước
                    </button>
                    <span>
                      Trang {pendingPage} / {pendingTotalPages}
                    </span>
                    <button
                      type="button"
                      disabled={pendingPage >= pendingTotalPages}
                      onClick={() => setPendingPage((p) => Math.min(pendingTotalPages, p + 1))}
                      className="rounded border border-white/20 px-3 py-1 disabled:opacity-40"
                    >
                      Sau
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">Không có khóa học thường nào đang chờ phê duyệt.</p>
            )}
          </>
        )}
      </div>
    </>
  );
}
