"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function LearnError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[learn-error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">
          Không thể tải nội dung học
        </h2>
        <p className="text-gray-400 max-w-md">
          Đã xảy ra lỗi. Vui lòng thử lại hoặc quay về trang học của bạn.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-lg bg-[#D4AF37] text-[#0a1628] font-medium hover:bg-[#c9a227] transition-colors"
          >
            Thử lại
          </button>
          <Link
            href="/student"
            className="px-5 py-2.5 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Về trang học
          </Link>
        </div>
      </div>
    </div>
  );
}
