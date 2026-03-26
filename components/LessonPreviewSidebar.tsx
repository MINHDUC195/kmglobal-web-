"use client";

import Link from "next/link";
import { useEffect } from "react";
import { normalizeChapterLabel } from "../lib/chapter-label";

type ChapterLesson = { id: string; name: string; sort_order: number };
type LessonPreviewSidebarProps = {
  chapterName: string;
  chapterLessons: ChapterLesson[];
  currentLessonId: string;
  completedLessonIds: string[];
  enrollmentId: string;
  isOpen: boolean;
  onClose: () => void;
};

export default function LessonPreviewSidebar({
  chapterName,
  chapterLessons,
  currentLessonId,
  completedLessonIds,
  enrollmentId,
  isOpen,
  onClose,
}: LessonPreviewSidebarProps) {
  const completedSet = new Set(completedLessonIds);
  const sortedLessons = [...chapterLessons].sort((a, b) => a.sort_order - b.sort_order);
  const chapterLabel = normalizeChapterLabel(chapterName);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  const sidebarContent = (
    <div className="flex h-full flex-col border-l border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 lg:justify-start lg:gap-2">
        <Link
          href={`/learn/${enrollmentId}`}
          className="flex items-center gap-2 text-sm font-medium text-[#002b2d] hover:underline"
        >
          <span aria-hidden>←</span>
          <span className="line-clamp-1">{chapterLabel}</span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          aria-label="Đóng menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <ul className="flex-1 overflow-y-auto p-3">
        {sortedLessons.map((lesson) => {
          const isCompleted = completedSet.has(lesson.id);
          const isActive = lesson.id === currentLessonId;
          return (
            <li key={lesson.id}>
              <Link
                href={`/learn/preview/${lesson.id}?enrollmentId=${enrollmentId}`}
                onClick={() => onClose()}
                className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-amber-50 font-medium text-[#002b2d]"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span
                  className={
                    isCompleted ? "text-[#22c55e]" : "text-gray-400"
                  }
                  aria-hidden
                >
                  {isCompleted ? "✓" : "○"}
                </span>
                <span className="line-clamp-2 flex-1">{lesson.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <>
      {/* Mobile: overlay + drawer */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`
          fixed right-0 top-0 z-50 h-full w-72 transform transition-transform duration-200 ease-out
          lg:static lg:z-auto lg:block lg:shrink-0 lg:w-72 lg:transform-none
          ${isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
