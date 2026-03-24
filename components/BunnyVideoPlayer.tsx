"use client";

import { useEffect, useState } from "react";

type BunnyVideoPlayerProps = {
  /** Xem trong khóa học: server ký từ video_url trong DB sau khi kiểm tra enrollment */
  lessonId?: string;
  enrollmentId?: string | null;
  /** Chỉ owner/admin: xem trước URL trong form (chưa lưu) */
  previewVideoUrl?: string;
  autoplay?: boolean;
  preload?: "auto" | "metadata" | "none";
  className?: string;
};

export default function BunnyVideoPlayer({
  lessonId,
  enrollmentId,
  previewVideoUrl,
  autoplay = false,
  preload = "metadata",
  className = "",
}: BunnyVideoPlayerProps) {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSignedUrl() {
      try {
        if (!previewVideoUrl?.trim() && !lessonId?.trim()) {
          setError("Chưa cấu hình video");
          return;
        }
        let url: string;
        if (previewVideoUrl?.trim()) {
          url = `/api/bunny/signed-url?previewVideoUrl=${encodeURIComponent(previewVideoUrl.trim())}`;
        } else {
          const q = new URLSearchParams({ lessonId: lessonId!.trim() });
          if (enrollmentId?.trim()) q.set("enrollmentId", enrollmentId.trim());
          url = `/api/bunny/signed-url?${q.toString()}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok) {
          setError(data.error || "Không thể tải video");
          return;
        }

        setEmbedUrl(data.url);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Lỗi kết nối. Kiểm tra mạng và cấu hình Bunny.net.");
        }
      }
    }

    void fetchSignedUrl();
    return () => {
      cancelled = true;
    };
  }, [lessonId, enrollmentId, previewVideoUrl]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-12 text-amber-200 ${className}`}
      >
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (!embedUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-white/10 bg-[#0b1323] px-6 py-12 ${className}`}
      >
        <p className="text-sm text-gray-400">Đang tải video...</p>
      </div>
    );
  }

  const params = new URLSearchParams();
  if (autoplay) params.set("autoplay", "true");
  if (preload) params.set("preload", preload);

  const iframeSrc = params.toString() ? `${embedUrl}&${params.toString()}` : embedUrl;

  return (
    <div className={`aspect-video w-full overflow-hidden rounded-xl bg-black ${className}`}>
      <iframe
        src={iframeSrc}
        loading="lazy"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
        allowFullScreen
        className="h-full w-full"
        title="Video bài học"
      />
    </div>
  );
}
