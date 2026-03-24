"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CONFIRM = "TẠM KHÓA 3 NGÀY";

type SelfTempLockSectionProps = {
  /** Đã có ít nhất một giao dịch thanh toán thành công */
  hasPaidBefore: boolean;
};

export default function SelfTempLockSection({ hasPaidBefore }: SelfTempLockSectionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!hasPaidBefore) return null;

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/student/account/self-temp-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Không thực hiện được.");
        return;
      }
      router.push("/account-temp-locked");
      router.refresh();
    } catch {
      setError("Lỗi kết nối.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-10 rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-[#D4AF37]">Tạm khóa tài khoản 3 ngày</h2>
      <p className="mt-2 text-sm text-white/75">
        Nếu bạn cần tạm ngưng truy cập (ví dụ sau khi đã được cảnh báo hủy đăng ký), có thể tự
        kích hoạt khóa 3 ngày. Sau thời hạn hệ thống tự mở lại; bạn sẽ nhận email xác nhận.
      </p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-full border border-amber-500/60 px-5 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/10"
        >
          Yêu cầu tạm khóa 3 ngày
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-amber-200/90">
            Nhập <span className="font-mono font-bold">{CONFIRM}</span> để xác nhận:
          </p>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            className="w-full max-w-sm rounded-lg border border-white/20 bg-[#0a1628] px-4 py-2 font-mono text-sm text-white outline-none focus:border-[#D4AF37]"
            placeholder={CONFIRM}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={input !== CONFIRM || loading}
              onClick={() => void submit()}
              className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? "Đang xử lý..." : "Xác nhận tạm khóa"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setInput("");
                setError("");
              }}
              className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
