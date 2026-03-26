"use client";

import Link from "next/link";

type LessonPrevNextProps = {
  prevLessonId: string | null;
  nextLessonId: string | null;
  enrollmentId: string;
  onNavigateStart?: () => void;
};

export default function LessonPrevNext({
  prevLessonId,
  nextLessonId,
  enrollmentId,
  onNavigateStart,
}: LessonPrevNextProps) {
  const courseUrl = `/learn/${enrollmentId}`;

  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-4 border-t border-[#D9E2EC] pt-8">
      {prevLessonId ? (
        <Link
          href={`/learn/preview/${prevLessonId}?enrollmentId=${enrollmentId}`}
          onClick={onNavigateStart}
          className="inline-flex items-center gap-2 rounded-full border border-[#BCCCDC] px-6 py-2.5 text-sm font-semibold text-[#0F2D4A] hover:bg-[#F0F4F8]"
        >
          <span aria-hidden>←</span>
          Trước
        </Link>
      ) : (
        <Link
          href={courseUrl}
          className="inline-flex items-center gap-2 rounded-full border border-[#BCCCDC] px-6 py-2.5 text-sm font-semibold text-[#486581] hover:bg-[#F0F4F8]"
        >
          <span aria-hidden>←</span>
          Về danh sách bài
        </Link>
      )}
      {nextLessonId ? (
        <Link
          href={`/learn/preview/${nextLessonId}?enrollmentId=${enrollmentId}`}
          onClick={onNavigateStart}
          className="inline-flex items-center gap-2 rounded-full border border-[#0F4C81] bg-[#0F4C81] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3A61]"
        >
          Tiếp theo
          <span aria-hidden>→</span>
        </Link>
      ) : (
        <Link
          href={courseUrl}
          className="inline-flex items-center gap-2 rounded-full border border-[#BCCCDC] px-6 py-2.5 text-sm font-semibold text-[#0F2D4A] hover:bg-[#F0F4F8]"
        >
          Về danh sách bài
          <span aria-hidden>→</span>
        </Link>
      )}
    </div>
  );
}
