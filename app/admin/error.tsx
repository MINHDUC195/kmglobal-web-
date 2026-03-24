"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin-error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Đã xảy ra lỗi (Admin)
        </h2>
        <p className="text-gray-400 max-w-md">
          Không thể tải trang quản trị. Vui lòng thử lại.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="px-5 py-2.5 rounded-lg bg-[#D4AF37] text-[#0a1628] font-medium hover:bg-[#c9a227] transition-colors"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
