"use client";

import dynamic from "next/dynamic";

const mediaSkeleton = (
  <div className="h-52 animate-pulse rounded-xl border border-[#E4E7EB] bg-[#F8FAFC]" />
);

export const LazyBunnyVideoPlayer = dynamic(
  () => import("../../../../components/BunnyVideoPlayer"),
  { ssr: false, loading: () => mediaSkeleton }
);

export const LazyPDFViewer = dynamic(
  () => import("../../../../components/PDFViewer"),
  { ssr: false, loading: () => mediaSkeleton }
);

export const LazyQuizSingleChoice = dynamic(
  () => import("../../../../components/QuizSingleChoice"),
  { ssr: false }
);

export const LazyQuizMultipleChoice = dynamic(
  () => import("../../../../components/QuizMultipleChoice"),
  { ssr: false }
);

export const LazyQuizFillBlank = dynamic(
  () => import("../../../../components/QuizFillBlank"),
  { ssr: false }
);

export const LazyLessonQASection = dynamic(
  () => import("../../../../components/LessonQASection"),
  { ssr: false, loading: () => <p className="text-sm text-[#486581]">Đang tải thảo luận...</p> }
);
