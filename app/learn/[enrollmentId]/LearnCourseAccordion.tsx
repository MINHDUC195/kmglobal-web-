"use client";

import Link from "next/link";
import { useState } from "react";

type Lesson = { id: string; name: string; sort_order: number };
type Chapter = { id: string; name: string; sort_order: number };
type Props = {
  chapters: Chapter[];
  lessonsByChapter: Record<string, Lesson[]>;
  completedLessonIds: string[];
  enrollmentId: string;
  isPaid: boolean;
  checkoutUrl: string;
};

export default function LearnCourseAccordion({
  chapters,
  lessonsByChapter,
  completedLessonIds,
  enrollmentId,
  isPaid,
  checkoutUrl,
}: Props) {
  const [openChapterId, setOpenChapterId] = useState<string | null>(
    chapters[0]?.id ?? null
  );
  const completedSet = new Set(completedLessonIds);

  return (
    <div className="space-y-2">
      {chapters.map((ch, chIndex) => {
        const lessons = (lessonsByChapter[ch.id] ?? []).sort(
          (a, b) => a.sort_order - b.sort_order
        );
        const locked = !isPaid && chIndex >= 2;
        const isOpen = openChapterId === ch.id;

        return (
          <div
            key={ch.id}
            className={`rounded-xl border ${
              locked
                ? "border-amber-500/40 bg-amber-50"
                : "border-gray-200 bg-white shadow-sm"
            }`}
          >
            <button
              type="button"
              onClick={() =>
                setOpenChapterId(isOpen ? null : ch.id)
              }
              className="flex w-full items-center justify-between px-4 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-500">
                  {isOpen ? "▼" : "▶"}
                </span>
                <h3 className="font-semibold text-[#002b2d]">{ch.name}</h3>
                {locked && (
                  <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    Cần thanh toán
                  </span>
                )}
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-gray-200 px-4 pb-4 pt-2">
                <ul className="space-y-1">
                  {lessons.map((lesson) => (
                    <li key={lesson.id}>
                      {locked ? (
                        <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-gray-500">
                          <span className="text-base">○</span>
                          <span>{lesson.name}</span>
                          <span className="text-amber-500">🔒</span>
                        </div>
                      ) : (
                        <Link
                          href={`/learn/preview/${lesson.id}?enrollmentId=${enrollmentId}`}
                          className="flex items-center gap-2 rounded-lg px-3 py-2.5 transition hover:bg-gray-50"
                        >
                          <span
                            className={
                              completedSet.has(lesson.id)
                                ? "text-[#22c55e]"
                                : "text-gray-500"
                            }
                          >
                            {completedSet.has(lesson.id)
                              ? "✓"
                              : "○"}
                          </span>
                          <span
                            className={
                              completedSet.has(lesson.id)
                                ? "text-gray-500"
                                : "text-gray-800"
                            }
                          >
                            {lesson.name}
                          </span>
                          {!completedSet.has(lesson.id) && (
                            <span className="ml-auto text-sm text-[#002b2d]">→</span>
                          )}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
                {locked && (
                  <Link
                    href={checkoutUrl}
                    className="mt-4 inline-block rounded-full bg-[#002b2d] px-5 py-2 text-sm font-bold text-white hover:bg-[#004144]"
                  >
                    Thanh toán để tiếp tục
                  </Link>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
