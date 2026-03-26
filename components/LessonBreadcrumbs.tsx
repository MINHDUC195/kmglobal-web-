"use client";

import Link from "next/link";
import { normalizeChapterLabel } from "../lib/chapter-label";

type LessonBreadcrumbsProps = {
  courseName?: string | null;
  chapterName?: string | null;
  lessonName: string;
  enrollmentId: string | null;
  prevLessonId?: string | null;
  nextLessonId?: string | null;
  /** Gọi khi bấm hamburger (mobile) để mở sidebar drawer */
  onMenuClick?: () => void;
};

export default function LessonBreadcrumbs({
  courseName,
  chapterName,
  lessonName,
  enrollmentId,
  prevLessonId,
  nextLessonId,
  onMenuClick,
}: LessonBreadcrumbsProps) {
  const hasContext = enrollmentId && (courseName || chapterName);
  const chapterLabel = normalizeChapterLabel(chapterName);

  if (!hasContext) {
    return (
      <nav
        className="flex flex-wrap items-center gap-2 text-xs font-medium sm:text-sm"
        aria-label="Breadcrumb"
      >
        <span className="rounded-full border border-[#BCCCDC] bg-white px-3 py-1 text-[#334E68]">
          Bài học
        </span>
        <span className="text-[#7B8794]">›</span>
        <span
          className="max-w-full truncate rounded-full border border-[#9FB3C8] bg-[#334E68] px-3 py-1 text-white sm:max-w-xl"
          title={lessonName}
        >
          {lessonName}
        </span>
      </nav>
    );
  }

  return (
    <nav
      className="flex flex-wrap items-center gap-2 text-xs font-medium sm:text-sm"
      aria-label="Breadcrumb"
    >
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-lg border border-[#BCCCDC] bg-white p-1.5 text-[#486581] hover:bg-[#F0F4F8] hover:text-[#102A43] lg:hidden"
          aria-label="Mở menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      <Link
        href={`/learn/${enrollmentId}`}
        className="max-w-full truncate rounded-full border border-[#BCCCDC] bg-white px-3 py-1 text-[#334E68] transition hover:border-[#829AB1] hover:bg-[#F0F4F8] sm:max-w-xs"
        title={courseName ?? "Khóa học"}
      >
        {courseName ?? "Khóa học"}
      </Link>
      {chapterName && (
        <>
          <span className="text-[#7B8794]">›</span>
          <Link
            href={`/learn/${enrollmentId}`}
            className="max-w-full truncate rounded-full border border-[#7B8794] bg-[#334E68] px-3 py-1 text-white transition hover:bg-[#243B53] sm:max-w-sm"
            title={chapterLabel}
          >
            {chapterLabel}
          </Link>
        </>
      )}
      <span className="text-[#7B8794]">›</span>
      <span
        className="max-w-full truncate rounded-full border border-[#D4AF37]/60 bg-[#FFF7E6] px-3 py-1 font-semibold text-[#8D5A00] sm:max-w-md"
        title={lessonName}
      >
        {lessonName}
      </span>
      {enrollmentId && (
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          {prevLessonId ? (
            <Link
              href={`/learn/preview/${prevLessonId}?enrollmentId=${encodeURIComponent(enrollmentId)}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2F9E44] text-base font-semibold text-white shadow-sm transition hover:bg-[#2B8A3E]"
              aria-label="Bài trước"
              title="Bài trước"
            >
              <span aria-hidden>←</span>
            </Link>
          ) : (
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#8FD19E] text-base font-semibold text-white/90"
              aria-hidden
              title="Không có bài trước"
            >
              <span aria-hidden>←</span>
            </span>
          )}
          {nextLessonId ? (
            <Link
              href={`/learn/preview/${nextLessonId}?enrollmentId=${encodeURIComponent(enrollmentId)}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#2F9E44] text-base font-semibold text-white shadow-sm transition hover:bg-[#2B8A3E]"
              aria-label="Bài tiếp theo"
              title="Bài tiếp theo"
            >
              <span aria-hidden>→</span>
            </Link>
          ) : (
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#8FD19E] text-base font-semibold text-white/90"
              aria-hidden
              title="Không có bài tiếp theo"
            >
              <span aria-hidden>→</span>
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
