"use client";

import { useEffect, useRef, useState } from "react";

type PDFViewerProps = {
  /** URL trong DB sau khi kiểm tra enrollment — server tải PDF từ lesson */
  lessonId?: string;
  enrollmentId?: string | null;
  /** Chỉ owner/admin: xem trước URL trong form (chưa lưu) */
  previewDocumentUrl?: string;
  className?: string;
};

export default function PDFViewer({
  lessonId,
  enrollmentId,
  previewDocumentUrl,
  className = "",
}: PDFViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const missingParams = !previewDocumentUrl?.trim() && !lessonId?.trim();

  useEffect(() => {
    if (missingParams) return;

    let cancelled = false;

    async function fetchWatermarkedPdf() {
      try {
        const body: Record<string, string | undefined> = {};
        if (previewDocumentUrl?.trim()) {
          body.previewDocumentUrl = previewDocumentUrl.trim();
        } else if (lessonId?.trim()) {
          body.lessonId = lessonId.trim();
          if (enrollmentId?.trim()) body.enrollmentId = enrollmentId.trim();
        }

        const res = await fetch("/api/pdf/watermark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          credentials: "include",
        });

        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 401) {
            setError("Bạn cần đăng nhập để xem tài liệu");
            return;
          }
          setError("Không thể tải tài liệu");
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Lỗi kết nối. Kiểm tra mạng.");
        }
      }
    }

    void fetchWatermarkedPdf();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [lessonId, enrollmentId, previewDocumentUrl, missingParams]);

  if (missingParams) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-12 text-amber-200 ${className}`}
      >
        <p className="text-sm">Thiếu lessonId hoặc previewDocumentUrl</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-12 text-amber-200 ${className}`}
      >
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-white/10 bg-[#0b1323] px-6 py-12 ${className}`}
      >
        <p className="text-sm text-gray-400">Đang tải tài liệu...</p>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-white ${className}`}>
      <iframe
        src={blobUrl}
        title="Tài liệu PDF"
        className="h-[600px] w-full min-h-[400px]"
      />
    </div>
  );
}
