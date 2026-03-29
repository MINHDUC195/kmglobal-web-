"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminBreadcrumbStrip } from "../../../components/AdminHierarchyBreadcrumb";

type CourseRow = {
  id: string;
  name: string;
  displayStatus: string;
  enrollmentCount: number;
  learningOpen: boolean;
  pendingDeletionRequestId: string | null;
  canRequestDeletion: boolean;
  registration_open_at: string | null;
  registration_close_at: string | null;
  course_start_at: string | null;
  course_end_at: string | null;
  program: { id: string; name: string } | null;
  base_course: { id: string; name: string; code: string } | null;
};

type FilterKey = "all" | "registration" | "learning" | "ended";
type PageMeta = { total: number; page: number; pageSize: number; totalPages: number };

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "Tất cả",
  registration: "Đang mở đăng ký",
  learning: "Đang mở để học",
  ended: "Đã kết thúc",
};

export default function AdminRegularCoursesPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalCourse, setModalCourse] = useState<CourseRow | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/regular-courses?filter=${encodeURIComponent(filter)}&page=${page}&pageSize=20`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không tải được danh sách.");
        setCourses([]);
        setMeta(null);
        return;
      }
      setCourses(data.courses ?? []);
      setMeta((data.meta as PageMeta | undefined) ?? null);
    } catch {
      setError("Lỗi mạng.");
      setCourses([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  async function submitDeletionRequest() {
    if (!modalCourse || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/course-deletion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regular_course_id: modalCourse.id,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không gửi được yêu cầu.");
        return;
      }
      setModalCourse(null);
      setReason("");
      void load();
    } catch {
      setError("Lỗi mạng.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelRequest(requestId: string) {
    if (!confirm("Hủy yêu cầu xóa đang chờ Owner phê duyệt?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/course-deletion-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không hủy được.");
        return;
      }
      void load();
    } catch {
      setError("Lỗi mạng.");
    }
  }

  return (
    <>
      <AdminBreadcrumbStrip
        items={[
          { label: "Trang quản trị", href: "/admin" },
          { label: "Khóa học thường" },
        ]}
      />
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-[#D4AF37]">
            ← Dashboard Admin
          </Link>
        </div>

        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Khóa học thường (mở đăng ký / học)
        </h1>
        <p className="mt-2 max-w-3xl text-gray-400">
          Danh sách các phiên khóa học thường (regular_courses). Admin/Owner có thể đề nghị xóa khi chưa có học viên đăng ký.
          Owner đề nghị sẽ được phê duyệt và xóa ngay; Admin đề nghị chờ Owner phê duyệt tại &quot;Phê duyệt xóa khóa&quot;.
        </p>
        <p className="mt-2 max-w-3xl text-xs text-gray-500">
          Cột <span className="text-gray-400">Học viên</span> đếm đăng ký <strong className="text-gray-400">đang hiệu lực</strong> (trạng thái{" "}
          <strong className="text-gray-400">active</strong> trên hệ thống).{" "}
          <strong className="text-gray-400">Không</strong> tính người đã hủy (<span className="text-gray-400">cancelled</span>) hoặc hết hạn (
          <span className="text-gray-400">expired</span>). Học viên hủy nhiều lần tới mức bị khóa tài khoản (ví dụ hủy 5 lần khi chưa thanh toán)
          vẫn chỉ có một bản ghi đăng ký cho khóa đó — sau lần hủy cuối bản ghi là <span className="text-gray-400">cancelled</span>, nên{" "}
          <strong className="text-gray-400">không</strong> vào số «Học viên» ở đây. Báo cáo Owner «Thông tin thanh toán» là theo{" "}
          <strong className="text-gray-400">giao dịch</strong>, không phải chỉ số đăng ký.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                filter === k
                  ? "bg-[#D4AF37] text-black"
                  : "border border-white/20 text-gray-300 hover:border-[#D4AF37]/50"
              }`}
            >
              {FILTER_LABELS[k]}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mt-10 text-gray-500">Đang tải...</p>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm text-gray-200">
                <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="px-4 py-3">Khóa học</th>
                    <th className="px-4 py-3">Chương trình / Khóa cơ bản</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Học viên</th>
                    <th className="px-4 py-3 w-52"></th>
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                        Không có khóa học nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    courses.map((c) => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/regular-courses/${c.id}`}
                            className="font-medium text-white hover:text-[#D4AF37]"
                          >
                            {c.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          <div>{c.program?.name ?? "—"}</div>
                          <div className="text-xs text-gray-500">{c.base_course?.name ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-gray-300">
                            {c.displayStatus}
                          </span>
                          {c.learningOpen && (
                            <span className="ml-1 text-xs text-emerald-400/90">· Đang trong thời gian học</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{c.enrollmentCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <Link
                              href={`/admin/regular-courses/${c.id}`}
                              className="text-[#D4AF37] hover:underline"
                            >
                              Chi tiết
                            </Link>
                            {c.canRequestDeletion && (
                              <button
                                type="button"
                                onClick={() => {
                                  setModalCourse(c);
                                  setReason("");
                                }}
                                className="text-left text-rose-300/90 hover:underline"
                              >
                                Đề nghị xóa
                              </button>
                            )}
                            {c.pendingDeletionRequestId && (
                              <button
                                type="button"
                                onClick={() => void cancelRequest(c.pendingDeletionRequestId!)}
                                className="text-left text-amber-200/90 hover:underline"
                              >
                                Hủy yêu cầu xóa
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {meta && meta.totalPages > 1 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500">
                  Trang {meta.page}/{meta.totalPages} · Tổng {meta.total} mục
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={meta.page <= 1}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-gray-300 disabled:opacity-40"
                  >
                    ← Trước
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                    disabled={meta.page >= meta.totalPages}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-gray-300 disabled:opacity-40"
                  >
                    Sau →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {modalCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#D4AF37]/30 bg-[#0f1c33] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-[#D4AF37]">Đề nghị xóa khóa học</h2>
            <p className="mt-2 text-sm text-gray-300">{modalCourse.name}</p>
            <p className="mt-2 text-xs text-gray-500">
              Chỉ áp dụng khi chưa có học viên đăng ký. Owner sẽ phê duyệt trước khi hệ thống xóa.
            </p>
            <label className="mt-4 block text-sm text-gray-400">Lý do (tùy chọn)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-[#D4AF37]/50 focus:outline-none"
              placeholder="Ví dụ: Trùng lịch, tạo nhầm..."
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalCourse(null)}
                className="rounded-full border border-white/20 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitDeletionRequest()}
                className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black hover:bg-[#e4c657] disabled:opacity-50"
              >
                {submitting ? "Đang gửi..." : "Gửi đề nghị"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
