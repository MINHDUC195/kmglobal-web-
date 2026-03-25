"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CONFIRM_TEXT = "HỦY ĐĂNG KÝ";

type CancelEnrollmentButtonProps = {
  enrollmentId: string;
  courseName: string;
  /** Nút bước 0: dùng onDark khi đặt trên nền tối (vd trang chi tiết khóa học) */
  variant?: "default" | "onDark";
  className?: string;
};

export default function CancelEnrollmentButton({
  enrollmentId,
  courseName,
  variant = "default",
  className = "",
}: CancelEnrollmentButtonProps) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCancel() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/student/enrollments/${enrollmentId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Không thể hủy đăng ký");
        return;
      }

      if (data.accountLocked) {
        router.push("/account-locked");
        router.refresh();
        return;
      }

      if (data.warningLevel === "third" || data.warningLevel === "fourth") {
        const base =
          `Đây là lần hủy thứ ${data.cancelCount ?? ""} cho khóa này. Từ lần thứ 3 hệ thống cố gắng gửi email cảnh báo. Tối đa 5 lần; vượt quá có thể khóa tài khoản (chưa thanh toán) hoặc xóa dữ liệu học (đã thanh toán).`;
        const emailNote =
          data.emailSent === false
            ? "\n\n(Lưu ý: Email cảnh báo chưa gửi được từ máy chủ — thường do chưa cấu hình dịch vụ gửi mail trên production. Vui lòng liên hệ quản trị nếu cần.)"
            : "";
        window.alert(base + emailNote);
      }

      if (data.learningDataCleared) {
        window.alert(
          "Lần hủy thứ 5 (đã thanh toán): dữ liệu học của khóa này đã được xóa. Bạn không thể đăng ký lại cùng khóa này."
        );
      }

      router.push("/student");
      router.refresh();
    } catch {
      setError("Lỗi kết nối. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  }

  if (step === 0) {
    const step0Tone =
      variant === "onDark"
        ? "border-amber-400/50 text-amber-200 hover:bg-amber-500/10"
        : "border-amber-500/60 text-amber-700 hover:bg-amber-50";
    return (
      <button
        type="button"
        onClick={() => setStep(1)}
        className={`rounded-full border px-6 py-2.5 text-sm font-semibold transition ${step0Tone} ${className}`}
      >
        Hủy đăng ký
      </button>
    );
  }

  if (step === 1) {
    return (
      <div
        className={`rounded-xl border border-amber-500/50 bg-amber-50 p-6 ${className}`}
      >
        <p className="font-semibold text-amber-800">Xác nhận lần 1</p>
        <p className="mt-2 text-sm text-amber-700">
          Bạn có chắc muốn hủy đăng ký khóa &quot;{courseName}&quot;?
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Tôi muốn hủy
          </button>
          <button
            type="button"
            onClick={() => setStep(0)}
            className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Không, quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-amber-500/50 bg-amber-50 p-6 ${className}`}
    >
      <p className="font-semibold text-amber-800">Xác nhận lần 2</p>
      <p className="mt-2 text-sm text-amber-700">
        Nhập <span className="font-mono font-bold">{CONFIRM_TEXT}</span> để xác
        nhận hủy đăng ký:
      </p>
      <input
        type="text"
        value={confirmInput}
        onChange={(e) => setConfirmInput(e.target.value.toUpperCase())}
        placeholder={CONFIRM_TEXT}
        className="mt-3 w-full rounded-lg border border-amber-300 bg-white px-4 py-2 font-mono text-amber-800 outline-none focus:border-amber-500"
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={confirmInput !== CONFIRM_TEXT || loading}
          className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Đang xử lý..." : "Xác nhận hủy đăng ký"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep(0);
            setConfirmInput("");
            setError("");
          }}
          disabled={loading}
          className="rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Quay lại
        </button>
      </div>
    </div>
  );
}
