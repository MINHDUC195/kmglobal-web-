"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
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
};

function PreviewLessonContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const enrollmentId = searchParams.get("enrollmentId");
  const lessonId = params.lessonId as string;
  const progressRecorded = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    progressRecorded.current = false;
  }, [lessonId]);

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const lessonUrl = enrollmentId
          ? `/api/lessons/${lessonId}?enrollmentId=${encodeURIComponent(enrollmentId)}`
          : `/api/lessons/${lessonId}`;
        const [lessonRes, questionsRes] = await Promise.all([
          fetch(lessonUrl),
          fetch(`/api/quiz/questions?lessonId=${lessonId}`),
        ]);

        if (!lessonRes.ok) {
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
        setLesson(lessonData);

        if (enrollmentId && !progressRecorded.current) {
          progressRecorded.current = true;
          void fetch("/api/learn/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lessonId, enrollmentId }),
          });
        }

        if (questionsRes.ok) {
          const { questions: qs } = await questionsRes.json();
          setQuestions(qs ?? []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi tải nội dung");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [lessonId, enrollmentId]);

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
    []
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
            className="mt-6 inline-block text-[#002b2d] hover:underline"
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
      <div className="flex min-h-screen flex-col bg-white">
        <LessonPreviewTopBar>
          <LessonBreadcrumbs
            courseName={lesson.courseName}
            chapterName={lesson.chapter?.name}
            lessonName={lesson.name}
            enrollmentId={enrollmentId}
            onMenuClick={() => setSidebarOpen(true)}
          />
        </LessonPreviewTopBar>
        <div className="flex flex-1">
          <main className="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold text-[#002b2d]">{lesson.name}</h1>
            {lesson.description && (
              <p className="mt-2 text-gray-600">{lesson.description}</p>
            )}

            <div className="mt-10 space-y-12">
              {lesson.video_url && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold text-[#002b2d]">Video</h2>
                  <BunnyVideoPlayer
                    lessonId={lessonId}
                    enrollmentId={enrollmentId}
                    className="max-w-3xl rounded-xl overflow-hidden"
                  />
                </section>
              )}

              {lesson.document_url && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold text-[#002b2d]">Tài liệu</h2>
                  <PDFViewer
                    lessonId={lessonId}
                    enrollmentId={enrollmentId}
                    className="max-w-3xl rounded-xl overflow-hidden"
                  />
                </section>
              )}

              {questions.length > 0 && (
                <section>
                  <h2 className="mb-6 text-lg font-semibold text-[#002b2d]">
                    Câu hỏi kiểm tra
                  </h2>
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
                      const commonProps = {
                        questionLabel,
                        maxPoints: q.points ?? 1,
                        attemptsUsed: q.attempt_count ?? 0,
                        maxAttempts: q.max_attempts ?? 3,
                        initialCorrect: q.has_correct ?? false,
                        initialPointsEarned: q.points_earned ?? 0,
                        initialStudentAnswerDisplay: q.student_answer_display,
                        initialCorrectAnswerDisplay: q.correct_answer_display,
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
              )}

              {enrollmentId && (
                <section>
                  <LessonQASection
                    lessonId={lessonId}
                    enrollmentId={enrollmentId}
                    lessonName={lesson.name}
                    variant="light"
                  />
                </section>
              )}
            </div>

            <LessonPrevNext
              prevLessonId={lesson.prevLessonId ?? null}
              nextLessonId={lesson.nextLessonId ?? null}
              enrollmentId={enrollmentId}
            />
          </main>
          <LessonPreviewSidebar
            chapterName={lesson.chapter!.name}
            chapterLessons={lesson.chapterLessons!}
            currentLessonId={lessonId}
            completedLessonIds={lesson.completedLessonIds ?? []}
            enrollmentId={enrollmentId!}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </div>
        <Footer hideLogo variant="light" />
      </div>
    );
  }

  // Simple layout (no enrollmentId or no chapter context)
  return (
    <div className="min-h-screen bg-white">
      <LessonPreviewTopBar>
        <LessonBreadcrumbs
          lessonName={lesson.name}
          enrollmentId={enrollmentId}
        />
      </LessonPreviewTopBar>
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-center gap-4">
          <Link
            href={enrollmentId ? `/learn/${enrollmentId}` : "/student"}
            className="text-sm text-gray-600 hover:text-[#002b2d]"
          >
            ← {enrollmentId ? "Về khóa học" : "Về Dashboard"}
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-[#002b2d]">{lesson.name}</h1>
        {lesson.description && (
          <p className="mt-2 text-gray-600">{lesson.description}</p>
        )}

        <div className="mt-10 space-y-12">
          {lesson.video_url && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-[#002b2d]">Video</h2>
              <BunnyVideoPlayer
                lessonId={lessonId}
                enrollmentId={enrollmentId}
                className="max-w-3xl rounded-xl overflow-hidden"
              />
            </section>
          )}

          {lesson.document_url && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-[#002b2d]">Tài liệu</h2>
              <PDFViewer
                lessonId={lessonId}
                enrollmentId={enrollmentId}
                className="max-w-3xl rounded-xl overflow-hidden"
              />
            </section>
          )}

          {questions.length > 0 && (
            <section>
              <h2 className="mb-6 text-lg font-semibold text-[#002b2d]">
                Câu hỏi kiểm tra
              </h2>
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
                  const commonProps = {
                    questionLabel,
                    maxPoints: q.points ?? 1,
                    attemptsUsed: q.attempt_count ?? 0,
                    maxAttempts: q.max_attempts ?? 3,
                    initialCorrect: q.has_correct ?? false,
                    initialPointsEarned: q.points_earned ?? 0,
                    initialStudentAnswerDisplay: q.student_answer_display,
                    initialCorrectAnswerDisplay: q.correct_answer_display,
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
          )}

          {enrollmentId && (
            <section>
              <LessonQASection
                lessonId={lessonId}
                enrollmentId={enrollmentId}
                lessonName={lesson.name}
                variant="light"
              />
            </section>
          )}
        </div>

        <Link
          href={enrollmentId ? `/learn/${enrollmentId}` : "/student"}
          className="mt-12 inline-block rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-[#002b2d] hover:bg-gray-50"
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
        <div className="flex min-h-screen items-center justify-center bg-white text-[#002b2d]">
          Đang tải bài học...
        </div>
      }
    >
      <PreviewLessonContent />
    </Suspense>
  );
}
