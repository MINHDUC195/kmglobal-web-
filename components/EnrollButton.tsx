"use client";

import { useState } from "react";
import { fetchWithRetry } from "@/lib/fetch-retry";

type EnrollButtonProps = {
  courseId: string;
  className?: string;
  children?: React.ReactNode;
  /** Khi true: không gọi API; dùng cùng thông báo với chặn server (admin/owner). */
  disabled?: boolean;
  disabledReason?: string;
};

export default function EnrollButton({
  courseId,
  className,
  children,
  disabled = false,
  disabledReason,
}: EnrollButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEnroll() {
    if (disabled) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetchWithRetry("/api/student/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          const returnUrl = typeof window !== "undefined" ? window.location.pathname : "/student";
          window.location.href = `/login?to=${encodeURIComponent(returnUrl)}`;
          return;
        }
        setError(data.error || "Không thể đăng ký");
        return;
      }

      const target = data.redirectUrl ?? (data.enrollmentId ? `/learn/${data.enrollmentId}` : "/student");
      window.location.href = target;
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleEnroll}
        disabled={loading || disabled}
        title={disabled ? disabledReason : undefined}
        className={className ?? "rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-50"}
      >
        {loading ? "Đang đăng ký..." : (children ?? "Đăng ký ngay")}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
