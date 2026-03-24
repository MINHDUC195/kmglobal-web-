"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="min-h-screen bg-[#0a1628] text-white font-sans antialiased flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl font-bold text-[#D4AF37]">500</div>
          <h1 className="text-xl font-semibold text-white">
            Đã xảy ra lỗi hệ thống
          </h1>
          <p className="text-gray-400">
            Xin lỗi, trang không thể tải. Vui lòng thử lại hoặc liên hệ hỗ trợ.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-3 rounded-lg bg-[#D4AF37] text-[#0a1628] font-medium hover:bg-[#c9a227] transition-colors"
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
