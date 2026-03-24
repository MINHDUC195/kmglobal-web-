"use client";

import Link from "next/link";

type LessonBreadcrumbsProps = {
  courseName?: string | null;
  chapterName?: string | null;
  lessonName: string;
  enrollmentId: string | null;
  /** Gọi khi bấm hamburger (mobile) để mở sidebar drawer */
  onMenuClick?: () => void;
};

export default function LessonBreadcrumbs({
  courseName,
  chapterName,
  lessonName,
  enrollmentId,
  onMenuClick,
}: LessonBreadcrumbsProps) {
  const hasContext = enrollmentId && (courseName || chapterName);

  if (!hasContext) {
    return (
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <span>Bài học</span>
        <span className="text-gray-400">/</span>
        <span className="truncate text-gray-800" title={lessonName}>
          {lessonName}
        </span>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
      {onMenuClick && (
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          aria-label="Mở menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      <Link
        href={`/learn/${enrollmentId}`}
        className="truncate hover:text-[#002b2d] hover:underline"
        title={courseName ?? "Khóa học"}
      >
        {courseName ?? "Khóa học"}
      </Link>
      {chapterName && (
        <>
          <span className="text-gray-400">›</span>
          <Link
            href={`/learn/${enrollmentId}`}
            className="truncate hover:text-[#002b2d] hover:underline"
            title={chapterName}
          >
            {chapterName}
          </Link>
        </>
      )}
      <span className="text-gray-400">›</span>
      <span className="max-w-[12rem] truncate text-gray-800 md:max-w-xs" title={lessonName}>
        {lessonName}
      </span>
    </nav>
  );
}
