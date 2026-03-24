"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PendingRequest = {
  id: string;
  reason: string | null;
  created_at: string;
  requested_by: string;
  requester_email: string | null;
  regular_course: {
    id: string;
    name: string;
    registration_open_at: string | null;
    registration_close_at: string | null;
    course_start_at: string | null;
    course_end_at: string | null;
    program: { name: string } | null;
    base_course: { name: string; code: string } | null;
  } | null;
};

export default function OwnerCourseDeletionsPage() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/course-deletion-requests");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không tải được.");
        setRequests([]);
        return;
      }
      setRequests(data.requests ?? []);
    } catch {
      setError("Lỗi mạng.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAction(id: string, action: "approve" | "reject") {
    const msg =
      action === "approve"
        ? "Phê duyệt xóa khóa học này? Hành động không thể hoàn tác."
        : "Từ chối yêu cầu xóa?";
    if (!confirm(msg)) return;
    setActing(id);
    setError(null);
    try {
      const res = await fetch(`/api/owner/course-deletion-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Thao tác thất bại.");
        return;
      }
      void load();
    } catch {
      setError("Lỗi mạng.");
    } finally {
      setActing(null);
    }
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href="/owner" className="text-sm text-gray-400 hover:text-[#D4AF37]">
          ← Dashboard Owner
        </Link>
      </div>

      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Phê duyệt xóa khóa học
      </h1>
      <p className="mt-2 max-w-2xl text-gray-400">
        Admin đề nghị xóa các phiên khóa học thường khi chưa có học viên đăng ký. Bạn phê duyệt hoặc từ chối từng yêu cầu.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-gray-500">Đang tải...</p>
      ) : requests.length === 0 ? (
        <p className="mt-10 rounded-xl border border-white/10 bg-white/5 px-6 py-10 text-center text-gray-400">
          Không có yêu cầu xóa nào đang chờ.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {requests.map((r) => {
            const rc = r.regular_course;
            return (
              <li
                key={r.id}
                className="rounded-xl border border-white/10 bg-white/5 p-5 sm:flex sm:items-start sm:justify-between sm:gap-6"
              >
                <div>
                  <h2 className="font-semibold text-white">{rc?.name ?? "Khóa học"}</h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {rc?.program?.name ?? "—"} · {rc?.base_course?.name ?? "—"}{" "}
                    {rc?.base_course?.code ? `(${rc.base_course.code})` : ""}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    Đề nghị lúc {new Date(r.created_at).toLocaleString("vi-VN")} · Người gửi:{" "}
                    {r.requester_email ?? r.requested_by.slice(0, 8) + "…"}
                  </p>
                  {r.reason && (
                    <p className="mt-3 rounded-lg border border-white/10 bg-[#0a1628]/80 px-3 py-2 text-sm text-gray-300">
                      Lý do: {r.reason}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex shrink-0 flex-wrap gap-2 sm:mt-0">
                  <button
                    type="button"
                    disabled={acting === r.id}
                    onClick={() => void handleAction(r.id, "reject")}
                    className="rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    disabled={acting === r.id}
                    onClick={() => void handleAction(r.id, "approve")}
                    className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e4c657] disabled:opacity-50"
                  >
                    {acting === r.id ? "Đang xử lý..." : "Phê duyệt & xóa"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
