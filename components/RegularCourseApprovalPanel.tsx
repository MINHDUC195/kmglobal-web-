"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  courseId: string;
  approvalStatus: string;
};

export default function RegularCourseApprovalPanel({ courseId, approvalStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const status = approvalStatus ?? "pending";

  async function submitForApproval() {
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

  const label =
    status === "approved"
      ? {
          text: "Đã phê duyệt — khóa hiển thị trên catalog và học viên có thể đăng ký (theo lịch đăng ký).",
          className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
        }
      : status === "pending"
        ? {
            text: "Chờ Owner phê duyệt — chưa hiển thị công khai cho học viên.",
            className: "border-amber-500/40 bg-amber-500/10 text-amber-100",
          }
        : {
            text: "Bản nháp — chưa hiển thị công khai. Gửi lên để Owner phê duyệt.",
            className: "border-white/20 bg-white/5 text-gray-300",
          };

  return (
    <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${label.className}`}>
      <p className="font-medium">Phê duyệt hiển thị: {status}</p>
      <p className="mt-1 text-xs opacity-90">{label.text}</p>
      {status === "draft" && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void submitForApproval()}
          className="mt-3 rounded-lg bg-[#D4AF37] px-4 py-2 text-xs font-bold text-black hover:bg-[#E7C768] disabled:opacity-60"
        >
          {loading ? "Đang gửi..." : "Gửi chờ Owner phê duyệt"}
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
