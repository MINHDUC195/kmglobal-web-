"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import BunnyVideoPlayer from "../../../../components/BunnyVideoPlayer";
import Footer from "../../../../components/Footer";
import LessonBreadcrumbs from "../../../../components/LessonBreadcrumbs";
import LessonPrevNext from "../../../../components/LessonPrevNext";
import LessonPreviewSidebar from "../../../../components/LessonPreviewSidebar";
import LessonPreviewTopBar from "../../../../components/LessonPreviewTopBar";
import PDFViewer from "../../../../components/PDFViewer";
import LessonQASection from "../../../../components/LessonQASection";
import QuizFillBlank from "../../../../components/QuizFillBlank";
import QuizMultipleChoice from "../../../../components/QuizMultipleChoice";
import QuizSingleChoice from "../../../../components/QuizSingleChoice";

type ChapterLesson = { id: string; name: string; sort_order: number };
type Lesson = {
  id: string;
  name: string;
  description: string | null;
  video_url: string | null;
  document_url: string | null;
  courseName?: string;
  programName?: string | null;
  chapter?: { id: string; name: string; sort_order: number } | null;
  chapterLessons?: ChapterLesson[];
  prevLessonId?: string | null;
  nextLessonId?: string | null;
  completedLessonIds?: string[];
};

type QuizQuestion = {
  id: string;
  content: string;
  type: "single_choice" | "multiple_choice" | "fill_blank";
  points: number;
  max_attempts: number;
  options: { id: string; option_text: string }[];
  attempt_count?: number;
  points_earned?: number;
  has_correct?: boolean;
  /** Chỉ khi hết lượt hoặc đạt đủ điểm (API quiz/questions) */
  student_answer_display?: string;
  correct_answer_display?: string;
  /** Khóa học đã đóng, chưa hoàn thành → khóa bài tập */
  course_expired_locked?: boolean;
};

const lessonPayloadCache = new Map<string, Lesson>();
const quizPayloadCache = new Map<string, QuizQuestion[]>();
const lessonPrefetchInFlight = new Map<string, Promise<void>>();
const quizPrefetchInFlight = new Map<string, Promise<void>>();
const METRIC_STORAGE_KEY = "kmg.learn.metrics";

function cacheKey(lessonId: string, enrollmentId: string | null): string {
  return `${lessonId}::${enrollmentId ?? ""}`;
}

function reportLearnMetric(metric: { name: string; valueMs: number; lessonId: string }) {
  if (typeof window === "undefined") return;
  const payload = { ...metric, at: new Date().toISOString() };
  try {
    const existingRaw = window.sessionStorage.getItem(METRIC_STORAGE_KEY);
    const existing = existingRaw ? (JSON.parse(existingRaw) as typeof payload[]) : [];
    window.sessionStorage.setItem(METRIC_STORAGE_KEY, JSON.stringify([...existing.slice(-19), payload]));
  } catch {
    // Ignore private mode / quota errors.
  }
  window.dispatchEvent(new CustomEvent("kmg:learn-metric", { detail: payload }));
}

async function prefetchLessonPayload(lessonId: string, enrollmentId: string | null): Promise<void> {
  const key = cacheKey(lessonId, enrollmentId);
  if (lessonPayloadCache.has(key)) return;
  const existing = lessonPrefetchInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const lessonUrl = enrollmentId
      ? `/api/lessons/${lessonId}?enrollmentId=${encodeURIComponent(enrollmentId)}`
      : `/api/lessons/${lessonId}`;
    const res = await fetch(lessonUrl);
    if (!res.ok) return;
    const payload = (await res.json()) as Lesson;
    lessonPayloadCache.set(key, payload);
  })()
    .catch(() => {})
    .finally(() => {
      lessonPrefetchInFlight.delete(key);
    });

  lessonPrefetchInFlight.set(key, promise);
  return promise;
}

async function prefetchQuizPayload(lessonId: string, enrollmentId: string | null): Promise<void> {
  if (!enrollmentId) return;
  const key = cacheKey(lessonId, enrollmentId);
  if (quizPayloadCache.has(key)) return;
  const existing = quizPrefetchInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const quizUrl = `/api/quiz/questions?lessonId=${lessonId}&enrollmentId=${encodeURIComponent(enrollmentId)}`;
    const res = await fetch(quizUrl);
    if (!res.ok) return;
    const payload = (await res.json()) as { questions?: QuizQuestion[] };
    quizPayloadCache.set(key, payload.questions ?? []);
  })()
    .catch(() => {})
    .finally(() => {
      quizPrefetchInFlight.delete(key);
    });

  quizPrefetchInFlight.set(key, promise);
  return promise;
}

function PreviewLessonContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get("enrollmentId");
  const lessonId = params.lessonId as string;
  const progressRecorded = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const lessonLoadStartedAtRef = useRef<number>(0);
  const handleNavigateStart = useCallback(() => {
    setLoading(true);
    setLesson(null);
    setQuestions([]);
    setError("");
  }, []);

  useEffect(() => {
    progressRecorded.current = false;
    setShowDiscussion(false);
    lessonLoadStartedAtRef.current = typeof performance !== "undefined" ? performance.now() : 0;
  }, [lessonId]);

  useEffect(() => {
    let cancelled = false;
    const lessonAbort = new AbortController();
    const quizAbort = new AbortController();

    async function loadQuestions() {
      if (!enrollmentId) {
        if (!cancelled) {
          setQuestions([]);
          setQuestionsLoading(false);
        }
        return;
      }
      setQuestionsLoading(true);
      const questionsUrl = `/api/quiz/questions?lessonId=${lessonId}&enrollmentId=${encodeURIComponent(enrollmentId)}`;
      const key = cacheKey(lessonId, enrollmentId);
      const cachedQuiz = quizPayloadCache.get(key);
      if (cachedQuiz) {
        if (!cancelled) {
          setQuestions(cachedQuiz);
          setQuestionsLoading(false);
          if (lessonLoadStartedAtRef.current > 0 && typeof performance !== "undefined") {
            reportLearnMetric({
              name: "lesson_quiz_ready",
              valueMs: Math.round(performance.now() - lessonLoadStartedAtRef.current),
              lessonId,
            });
          }
        }
        // Revalidate quiz in background; UI uses cached result first.
        void prefetchQuizPayload(lessonId, enrollmentId);
        return;
      }
      try {
        const questionsRes = await fetch(questionsUrl, { signal: quizAbort.signal });
        if (cancelled) return;
        if (questionsRes.ok) {
          const { questions: qs } = await questionsRes.json();
          if (!cancelled) {
            const normalized = qs ?? [];
            setQuestions(normalized);
            quizPayloadCache.set(key, normalized);
            if (lessonLoadStartedAtRef.current > 0 && typeof performance !== "undefined") {
              reportLearnMetric({
                name: "lesson_quiz_ready",
                valueMs: Math.round(performance.now() - lessonLoadStartedAtRef.current),
                lessonId,
              });
            }
          }
        } else if (!cancelled) {
          setQuestions([]);
        }
      } catch (e) {
        if (!cancelled && !(e instanceof DOMException && e.name === "AbortError")) {
          setQuestions([]);
        }
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    }

    async function loadLessonFirst() {
      const key = cacheKey(lessonId, enrollmentId);
      const cachedLesson = lessonPayloadCache.get(key);
      if (cachedLesson) {
        setLesson(cachedLesson);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError("");
      setQuestions([]);
      try {
        const lessonUrl = enrollmentId
          ? `/api/lessons/${lessonId}?enrollmentId=${encodeURIComponent(enrollmentId)}`
          : `/api/lessons/${lessonId}`;
        const lessonRes = await fetch(lessonUrl, { signal: lessonAbort.signal });

        if (!lessonRes.ok) {
          if (cancelled) return;
          if (lessonRes.status === 404) {
            setError("Không tìm thấy bài học");
            return;
          }
          if (lessonRes.status === 403) {
            const errData = await lessonRes.json().catch(() => ({}));
            setError((errData as { error?: string }).error ?? "Bạn không có quyền truy cập bài học này");
            return;
          }
          throw new Error("Lỗi tải bài học");
        }

        const lessonData = await lessonRes.json();
        if (cancelled) return;
        setLesson(lessonData);
        lessonPayloadCache.set(key, lessonData);
        setLoading(false);
        if (lessonLoadStartedAtRef.current > 0 && typeof performance !== "undefined") {
          reportLearnMetric({
            name: "lesson_content_ready",
            valueMs: Math.round(performance.now() - lessonLoadStartedAtRef.current),
            lessonId,
          });
        }

        if (enrollmentId && !progressRecorded.current) {
          progressRecorded.current = true;
          void fetch("/api/learn/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lessonId, enrollmentId }),
          });
        }
        void loadQuestions();
      } catch (e) {
        if (!cancelled && !(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Lỗi tải nội dung");
        }
        if (!cancelled) setLoading(false);
      }
    }

    void loadLessonFirst();

    return () => {
      cancelled = true;
      lessonAbort.abort();
      quizAbort.abort();
    };
  }, [lessonId, enrollmentId]);

  useEffect(() => {
    if (!enrollmentId || !lesson) return;
    const query = `?enrollmentId=${encodeURIComponent(enrollmentId)}`;
    if (lesson.prevLessonId) {
      router.prefetch(`/learn/preview/${lesson.prevLessonId}${query}`);
    }
    if (lesson.nextLessonId) {
      router.prefetch(`/learn/preview/${lesson.nextLessonId}${query}`);
    }

    const aroundIds = [lesson.prevLessonId, lesson.nextLessonId].filter(
      (id): id is string => Boolean(id)
    );
    for (const id of aroundIds) {
      void prefetchLessonPayload(id, enrollmentId);
      void prefetchQuizPayload(id, enrollmentId);
    }

    const chapterIds = (lesson.chapterLessons ?? [])
      .map((l) => l.id)
      .filter((id) => id !== lesson.id)
      .slice(0, 8);

    const idle = () => {
      chapterIds.forEach((id) => {
        void prefetchLessonPayload(id, enrollmentId);
      });
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(
        idle
      );
    } else {
      setTimeout(idle, 200);
    }
  }, [router, enrollmentId, lesson]);

  const handleQuizSubmit = useCallback(
    async (
      questionId: string,
      selectedOptionIds?: string[],
      fillBlankAnswer?: string
    ): Promise<{
      isCorrect: boolean;
      pointsEarned: number;
      maxPoints?: number;
      outOfAttempts?: boolean;
      studentAnswerDisplay?: string;
      correctAnswerDisplay?: string;
    }> => {
      const body: Record<string, unknown> = { questionId };
      if (fillBlankAnswer !== undefined) {
        body.fillBlankAnswer = fillBlankAnswer;
      } else {
        body.selectedOptionIds = selectedOptionIds ?? [];
      }
      if (enrollmentId) body.enrollmentId = enrollmentId;

      const res = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 400 && data.error) {
          const outOfAttempts = data.error === "Đã hết số lần trả lời";
          return { isCorrect: false, pointsEarned: 0, outOfAttempts };
        }
        throw new Error(data.error ?? "Lỗi chấm bài");
      }

      return {
        isCorrect: data.isCorrect,
        pointsEarned: data.pointsEarned,
        maxPoints: data.maxPoints,
        outOfAttempts: false,
        studentAnswerDisplay: data.studentAnswerDisplay,
        correctAnswerDisplay: data.correctAnswerDisplay,
      };
    },
    [enrollmentId]
  );

  const useEdXLayout =
    enrollmentId &&
    lesson?.chapter &&
    lesson?.chapterLessons &&
    lesson.chapterLessons.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <LessonPreviewTopBar />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
          <p className="text-gray-500">Đang tải...</p>
        </main>
        <Footer hideLogo variant="light" />
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-white">
        <LessonPreviewTopBar />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
          <p className="text-red-600">{error || "Không tìm thấy bài học"}</p>
          <Link
            href={enrollmentId ? `/learn/${enrollmentId}` : "/student"}
            className="mt-6 inline-block text-[#0F2D4A] hover:underline"
          >
            ← {enrollmentId ? "Về khóa học" : "Về Dashboard"}
          </Link>
        </main>
        <Footer hideLogo variant="light" />
      </div>
    );
  }

  if (useEdXLayout) {
    return (
      <div className="flex min-h-screen flex-col bg-[#F4F7FB]">
        <LessonPreviewTopBar programName={lesson.programName}>
          <LessonBreadcrumbs
            courseName={lesson.courseName}
            chapterName={lesson.chapter?.name}
            lessonName={lesson.name}
            enrollmentId={enrollmentId}
            prevLessonId={lesson.prevLessonId}
            nextLessonId={lesson.nextLessonId}
            onNavigateStart={handleNavigateStart}
            onMenuClick={() => setSidebarOpen(true)}
          />
        </LessonPreviewTopBar>
        <div className="flex flex-1 bg-[#EEF2F7]">
          <LessonPreviewSidebar
            chapterName={lesson.chapter!.name}
            chapterLessons={lesson.chapterLessons!}
            currentLessonId={lessonId}
            completedLessonIds={lesson.completedLessonIds ?? []}
            enrollmentId={enrollmentId!}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <section className="rounded-2xl border border-[#D9E2EC] bg-white p-5 shadow-[0_8px_20px_rgba(16,42,67,0.06)] sm:p-6">
              <h1 className="text-2xl font-bold text-[#0F2D4A]">{lesson.name}</h1>
              {lesson.description && (
                <p className="mt-2 text-gray-600">{lesson.description}</p>
              )}
            </section>

            <div className="mt-6 space-y-6">
              {lesson.video_url && (
                <section className="rounded-2xl border border-[#D9E2EC] bg-white p-5 shadow-[0_8px_20px_rgba(16,42,67,0.06)] sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold text-[#0F2D4A]">Video</h2>
                  <BunnyVideoPlayer
                    lessonId={lessonId}
                    enrollmentId={enrollmentId}
                    className="max-w-3xl rounded-xl overflow-hidden"
                  />
                </section>
              )}

              {lesson.document_url && (
                <section className="rounded-2xl border border-[#D9E2EC] bg-white p-5 shadow-[0_8px_20px_rgba(16,42,67,0.06)] sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold text-[#0F2D4A]">Tài liệu</h2>
                  <PDFViewer
                    lessonId={lessonId}
                    enrollmentId={enrollmentId}
                    className="max-w-3xl rounded-xl overflow-hidden"
                  />
                </section>
              )}

              {questionsLoading ? (
                <section className="rounded-2xl border border-[#D9E2EC] bg-white p-5 shadow-[0_8px_20px_rgba(16,42,67,0.06)] sm:p-6">
                  <h2 className="mb-6 text-lg font-semibold text-[#0F2D4A]">Câu hỏi kiểm tra</h2>
                  <p className="rounded-lg border border-[#D9E2EC] bg-white px-4 py-3 text-sm text-[#486581]">
                    Đang tải câu hỏi...
                  </p>
                </section>
              ) : questions.length > 0 ? (
                <section className="rounded-2xl border border-[#D9E2EC] bg-white p-5 shadow-[0_8px_20px_rgba(16,42,67,0.06)] sm:p-6">
                  <h2 className="mb-6 text-lg font-semibold text-[#0F2D4A]">
                    Câu hỏi kiểm tra
                  </h2>
                  {questions.some((q) => q.course_expired_locked) && (
                    <p className="mb-4 rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Khóa học đã kết thúc, bạn không thể làm bài tập hay xem đáp án.
                    </p>
                  )}
                  <div className="space-y-6">
                    {questions.map((q, qIdx) => {
                      const chapterNum = (lesson.chapter?.sort_order ?? 0) + 1;
                      const lessonNum =
                        lesson.chapterLessons?.findIndex((l) => l.id === lessonId) ?? 0;
                      const lessonNum1 = lessonNum + 1;
                      const questionNum = qIdx + 1;
                      const questionLabel =
                        lesson.chapter && lesson.chapterLessons?.length
                          ? `Câu ${chapterNum}.${lessonNum1}.${questionNum}`
                          : `Câu ${questionNum}`;
                      const quizLocked = !!q.course_expired_locked;
                      const commonProps = {
                        questionLabel,
                        maxPoints: q.points ?? 1,
                        attemptsUsed: q.attempt_count ?? 0,
                        maxAttempts: q.max_attempts ?? 3,
                        initialCorrect: q.has_correct ?? false,
                        initialPointsEarned: q.points_earned ?? 0,
                        initialStudentAnswerDisplay: q.student_answer_display,
                        initialCorrectAnswerDisplay: q.correct_answer_display,
                        disabled: quizLocked,
                      };
                      if (q.type === "single_choice") {
                        return (
                          <QuizSingleChoice
                            key={q.id}
                            questionId={q.id}
                            content={q.content}
                            options={q.options}
                            onSubmit={async (id, ids) =>
                              handleQuizSubmit(id, ids, undefined)
                            }
                            variant="light"
                            {...commonProps}
                          />
                        );
                      }
                      if (q.type === "multiple_choice") {
                        return (
                          <QuizMultipleChoice
                            key={q.id}
                            questionId={q.id}
                            content={q.content}
                            options={q.options}
                            onSubmit={async (id, ids) =>
                              handleQuizSubmit(id, ids, undefined)
                            }
                            variant="light"
                            {...commonProps}
                          />
                        );
                      }
                      return (
                        <QuizFillBlank
                          key={q.id}
                          questionId={q.id}
                          content={q.content}
                          onSubmit={async (id, answer) =>
                            handleQuizSubmit(id, undefined, answer)
                          }
                          variant="light"
                          {...commonProps}
                        />
                      );
                    })}
                  </div>
                </section>
              ) : (
                <section className="rounded-2xl border border-[#D9E2EC] bg-white p-5 shadow-[0_8px_20px_rgba(16,42,67,0.06)] sm:p-6">
                  <h2 className="mb-4 text-lg font-semibold text-[#0F2D4A]">
                    Bài tập kiểm tra
                  </h2>
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    Bài học này chưa có câu hỏi trắc nghiệm. Điểm quá trình khóa học không tính từ bài
                    tập cho bài này; bạn vẫn có thể xem video, tài liệu và tham gia hỏi đáp bên dưới.
                  </p>
                </section>
              )}

              {enrollmentId && (
                <section className="rounded-2xl border border-[#D9E2EC] bg-white p-5 shadow-[0_8px_20px_rgba(16,42,67,0.06)] sm:p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[#0F2D4A]">Thảo luận</h2>
                    <button
                      type="button"
                      onClick={() => setShowDiscussion((v) => !v)}
                      className="rounded-lg border border-[#9FB3C8] bg-white px-4 py-2 text-sm font-semibold text-[#334E68] hover:bg-[#F0F4F8]"
                    >
                      {showDiscussion ? "Ẩn thảo luận" : "Hiển thị thảo luận"}
                    </button>
                  </div>
                  {showDiscussion ? (
                    <LessonQASection
                      lessonId={lessonId}
                      enrollmentId={enrollmentId}
                      lessonName={lesson.name}
                      variant="light"
                    />
                  ) : (
                    <p className="rounded-lg border border-[#D9E2EC] bg-white px-4 py-3 text-sm text-[#486581]">
                      Nhấn &quot;Hiển thị thảo luận&quot; để tải phần hỏi đáp.
                    </p>
                  )}
                </section>
              )}
            </div>

            <div className="rounded-2xl border border-[#D9E2EC] bg-white p-5 shadow-[0_8px_20px_rgba(16,42,67,0.06)] sm:p-6">
              <LessonPrevNext
                prevLessonId={lesson.prevLessonId ?? null}
                nextLessonId={lesson.nextLessonId ?? null}
                enrollmentId={enrollmentId}
                onNavigateStart={handleNavigateStart}
              />
            </div>
          </main>
        </div>
        <Footer hideLogo variant="light" />
      </div>
    );
  }

  // Simple layout (no enrollmentId or no chapter context)
  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <LessonPreviewTopBar programName={lesson.programName}>
        <LessonBreadcrumbs
          lessonName={lesson.name}
          enrollmentId={enrollmentId}
          prevLessonId={lesson.prevLessonId}
          nextLessonId={lesson.nextLessonId}
          onNavigateStart={handleNavigateStart}
        />
      </LessonPreviewTopBar>
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href={enrollmentId ? `/learn/${enrollmentId}` : "/student"}
            className="text-sm text-gray-600 hover:text-[#0F2D4A]"
          >
            ← {enrollmentId ? "Về khóa học" : "Về Dashboard"}
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-[#0F2D4A]">{lesson.name}</h1>
        {lesson.description && (
          <p className="mt-2 text-gray-600">{lesson.description}</p>
        )}

        <div className="mt-10 space-y-12">
          {lesson.video_url && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-[#0F2D4A]">Video</h2>
              <BunnyVideoPlayer
                lessonId={lessonId}
                enrollmentId={enrollmentId}
                className="max-w-3xl rounded-xl overflow-hidden"
              />
            </section>
          )}

          {lesson.document_url && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-[#0F2D4A]">Tài liệu</h2>
              <PDFViewer
                lessonId={lessonId}
                enrollmentId={enrollmentId}
                className="max-w-3xl rounded-xl overflow-hidden"
              />
            </section>
          )}

          {questionsLoading ? (
            <section>
              <h2 className="mb-6 text-lg font-semibold text-[#0F2D4A]">
                Câu hỏi kiểm tra
              </h2>
              <p className="rounded-lg border border-[#D9E2EC] bg-white px-4 py-3 text-sm text-[#486581]">
                Đang tải câu hỏi...
              </p>
            </section>
          ) : questions.length > 0 ? (
            <section>
              <h2 className="mb-6 text-lg font-semibold text-[#0F2D4A]">
                Câu hỏi kiểm tra
              </h2>
              {questions.some((q) => q.course_expired_locked) && (
                <p className="mb-4 rounded-lg border border-amber-500/50 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Khóa học đã kết thúc, bạn không thể làm bài tập hay xem đáp án.
                </p>
              )}
              <div className="space-y-6">
                {questions.map((q, qIdx) => {
                  const chapterNum = (lesson.chapter?.sort_order ?? 0) + 1;
                  const lessonNum =
                    lesson.chapterLessons?.findIndex((l) => l.id === lessonId) ?? 0;
                  const lessonNum1 = lessonNum + 1;
                  const questionNum = qIdx + 1;
                  const questionLabel =
                    lesson.chapter && lesson.chapterLessons?.length
                      ? `Câu ${chapterNum}.${lessonNum1}.${questionNum}`
                      : `Câu ${questionNum}`;
                  const quizLocked = !!q.course_expired_locked;
                  const commonProps = {
                    questionLabel,
                    maxPoints: q.points ?? 1,
                    attemptsUsed: q.attempt_count ?? 0,
                    maxAttempts: q.max_attempts ?? 3,
                    initialCorrect: q.has_correct ?? false,
                    initialPointsEarned: q.points_earned ?? 0,
                    initialStudentAnswerDisplay: q.student_answer_display,
                    initialCorrectAnswerDisplay: q.correct_answer_display,
                    disabled: quizLocked,
                  };
                  if (q.type === "single_choice") {
                    return (
                      <QuizSingleChoice
                        key={q.id}
                        questionId={q.id}
                        content={q.content}
                        options={q.options}
                        onSubmit={async (id, ids) =>
                          handleQuizSubmit(id, ids, undefined)
                        }
                        variant="light"
                        {...commonProps}
                      />
                    );
                  }
                  if (q.type === "multiple_choice") {
                    return (
                      <QuizMultipleChoice
                        key={q.id}
                        questionId={q.id}
                        content={q.content}
                        options={q.options}
                        onSubmit={async (id, ids) =>
                          handleQuizSubmit(id, ids, undefined)
                        }
                        variant="light"
                        {...commonProps}
                      />
                    );
                  }
                  return (
                    <QuizFillBlank
                      key={q.id}
                      questionId={q.id}
                      content={q.content}
                      onSubmit={async (id, answer) =>
                        handleQuizSubmit(id, undefined, answer)
                      }
                      variant="light"
                      {...commonProps}
                    />
                  );
                })}
              </div>
            </section>
          ) : (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-[#0F2D4A]">Bài tập kiểm tra</h2>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Bài học này chưa có câu hỏi trắc nghiệm. Điểm quá trình khóa học không tính từ bài
                tập cho bài này; bạn vẫn có thể xem video, tài liệu và tham gia hỏi đáp bên dưới.
              </p>
            </section>
          )}

          {enrollmentId && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#0F2D4A]">Thảo luận</h2>
                <button
                  type="button"
                  onClick={() => setShowDiscussion((v) => !v)}
                  className="rounded-lg border border-[#9FB3C8] bg-white px-4 py-2 text-sm font-semibold text-[#334E68] hover:bg-[#F0F4F8]"
                >
                  {showDiscussion ? "Ẩn thảo luận" : "Hiển thị thảo luận"}
                </button>
              </div>
              {showDiscussion ? (
                <LessonQASection
                  lessonId={lessonId}
                  enrollmentId={enrollmentId}
                  lessonName={lesson.name}
                  variant="light"
                />
              ) : (
                <p className="rounded-lg border border-[#D9E2EC] bg-white px-4 py-3 text-sm text-[#486581]">
                  Nhấn &quot;Hiển thị thảo luận&quot; để tải phần hỏi đáp.
                </p>
              )}
            </section>
          )}
        </div>

        <Link
          href={enrollmentId ? `/learn/${enrollmentId}` : "/student"}
          className="mt-12 inline-block rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-[#0F2D4A] hover:bg-gray-50"
        >
          {enrollmentId ? "Về khóa học" : "Về Dashboard"}
        </Link>
      </main>
      <Footer hideLogo variant="light" />
    </div>
  );
}

export default function PreviewLessonPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-[#0F2D4A]">
          Đang tải bài học...
        </div>
      }
    >
      <PreviewLessonContent />
    </Suspense>
  );
}
