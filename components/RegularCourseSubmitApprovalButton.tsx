"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  courseId: string;
  approvalStatus: string;
};

/** Chỉ hiện khi khóa ở trạng thái nháp (draft); gọi API chuyển sang chờ Owner phê duyệt. */
export default function RegularCourseSubmitApprovalButton({ courseId, approvalStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (approvalStatus !== "draft") return null;

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
        className="inline-flex items-center justify-center rounded-full border border-amber-500/50 bg-amber-500/15 px-6 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/25 disabled:opacity-60"
      >
        {loading ? "Đang gửi..." : "Gửi phê duyệt hiển thị"}
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
    </div>
  );
}
