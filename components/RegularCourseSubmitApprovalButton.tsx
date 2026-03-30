"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  courseId: string;
  approvalStatus: string;
};

/**
 * draft: nút gửi lên Owner.
 * pending / approved: chỉ báo trạng thái (không tương tác).
 */
export default function RegularCourseSubmitApprovalButton({ courseId, approvalStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (approvalStatus === "pending") {
    return (
      <div
        className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-amber-500/45 bg-amber-500/10 px-6 py-2.5 text-sm font-medium text-amber-100"
        role="status"
      >
        Đã gửi phê duyệt — chờ Owner xử lý
      </div>
    );
  }

  if (approvalStatus === "approved") {
    return (
      <div
        className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-emerald-500/45 bg-emerald-500/10 px-6 py-2.5 text-sm font-medium text-emerald-100"
        role="status"
      >
        Đã phê duyệt hiển thị
      </div>
    );
  }

  if (approvalStatus !== "draft") {
    return null;
  }

  async function submit() {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/regular-courses/${courseId}/approval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Không gửi được");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={() => void submit()}
        className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-amber-500/50 bg-amber-500/15 px-6 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-60"
      >
        {loading ? "Đang gửi..." : "Gửi phê duyệt hiển thị"}
      </button>
      {error ? <p className="max-w-xs text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
