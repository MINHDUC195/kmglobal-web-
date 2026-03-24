"use client";

import Link from "next/link";

type LessonPrevNextProps = {
  prevLessonId: string | null;
  nextLessonId: string | null;
  enrollmentId: string;
};

export default function LessonPrevNext({
  prevLessonId,
  nextLessonId,
  enrollmentId,
}: LessonPrevNextProps) {
  const courseUrl = `/learn/${enrollmentId}`;

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-4 border-t border-gray-200 pt-8">
      {prevLessonId ? (
        <Link
          href={`/learn/preview/${prevLessonId}?enrollmentId=${enrollmentId}`}
          className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-[#002b2d] hover:bg-gray-50"
        >
          <span aria-hidden>←</span>
          Trước
        </Link>
      ) : (
        <Link
          href={courseUrl}
          className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          <span aria-hidden>←</span>
          Về danh sách bài
        </Link>
      )}
      {nextLessonId ? (
        <Link
          href={`/learn/preview/${nextLessonId}?enrollmentId=${enrollmentId}`}
          className="inline-flex items-center gap-2 rounded-full border border-[#002b2d] bg-[#002b2d] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#004144]"
        >
          Tiếp theo
          <span aria-hidden>→</span>
        </Link>
      ) : (
        <Link
          href={courseUrl}
          className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-[#002b2d] hover:bg-gray-50"
        >
          Về danh sách bài
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
