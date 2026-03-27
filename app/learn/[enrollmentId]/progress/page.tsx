import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getActiveLearnEnrollmentForUser } from "../../../../lib/get-active-learn-enrollment";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { resolveEnrollmentPaymentAccess } from "../../../../lib/enrollment-payment-status";

export const dynamic = "force-dynamic";

type ProgressPageProps = {
  params: Promise<{ enrollmentId: string }>;
};

type ChapterProgress = {
  id: string;
  name: string;
  sort_order: number;
  maxPoints: number;
  earnedPoints: number;
  lessons: {
    id: string;
    name: string;
    sort_order: number;
    maxPoints: number;
    earnedPoints: number;
  }[];
};

function ProgressSegmentBar({
  label,
  earned,
  max,
  percent,
  barColor = "bg-[#002b2d]/80",
  displayTextOverride,
  labelEmphasis,
}: {
  label: string;
  earned: number;
  max: number;
  percent: number;
  barColor?: string;
  displayTextOverride?: string;
  labelEmphasis?: boolean;
}) {
  const displayText =
    displayTextOverride ??
    (max > 0 ? `${earned}/${max} điểm (${Math.round(percent)}%)` : "—");
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span
          className={`text-gray-600 ${labelEmphasis ? "font-bold uppercase" : ""}`}
        >
          {label}
        </span>
        <span className="text-gray-800">{displayText}</span>
      </div>
      <div className="h-8 overflow-hidden rounded-lg bg-gray-200">
        <div
          className={`h-full rounded-lg transition-all ${barColor}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

export default async function LearnProgressPage({ params }: ProgressPageProps) {
  const { enrollmentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const enrollment = await getActiveLearnEnrollmentForUser(enrollmentId, user.id);
  if (!enrollment) notFound();

  const admin = getSupabaseAdminClient();
  const rcProgress = enrollment.regular_course as {
    price_cents?: number | null;
    discount_percent?: number | null;
    base_course?: {
      id?: string;
      certificate_pass_percent?: number | null;
      final_exam_weight_percent?: number | null;
    };
  } | null;
  const { needsPayment } = await resolveEnrollmentPaymentAccess(admin, {
    payment_id: enrollment.payment_id,
    regular_course: rcProgress ?? null,
  });
  const checkoutUrl = `/checkout?courseId=${enrollment.regular_course_id}`;

  const baseCourse = rcProgress?.base_course;
  const baseCourseId = baseCourse?.id;
  if (!baseCourseId) notFound();

  const rawCert = baseCourse?.certificate_pass_percent;
  const certificatePassPercent = Math.round(
    rawCert != null && !Number.isNaN(Number(rawCert)) ? Number(rawCert) : 70
  );

  const lessonWeight = 100 - (Number(baseCourse?.final_exam_weight_percent) ?? 30);
  const examWeight = Number(baseCourse?.final_exam_weight_percent) ?? 30;

  const { data: chapters } = await admin
    .from("chapters")
    .select("id, name, sort_order")
    .eq("base_course_id", baseCourseId)
    .order("sort_order");
  const chapterIds = (chapters ?? []).map((c) => c.id);

  const { data: allLessons } = chapterIds.length
    ? await admin
        .from("lessons")
        .select("id, chapter_id, name, sort_order")
        .in("chapter_id", chapterIds)
        .order("sort_order")
    : { data: [] };

  const lessonIds = (allLessons ?? []).map((l) => l.id);

  const { data: questions } = lessonIds.length
    ? await admin
        .from("questions")
        .select("id, lesson_id, points")
        .in("lesson_id", lessonIds)
    : { data: [] };

  const questionIds = (questions ?? []).map((q) => q.id);

  const bestPointsByQuestion: Record<string, number> = {};
  if (questionIds.length > 0) {
    const { data: attempts } = await admin
      .from("question_attempts")
      .select("question_id, points_earned")
      .in("question_id", questionIds)
      .eq("user_id", user.id);
    for (const a of attempts ?? []) {
      const pts = Number(a.points_earned) || 0;
      const prev = bestPointsByQuestion[a.question_id] ?? 0;
      bestPointsByQuestion[a.question_id] = Math.max(prev, pts);
    }
  }

  const lessonsByChapter = (allLessons ?? []).reduce(
    (acc, l) => {
      if (!acc[l.chapter_id]) acc[l.chapter_id] = [];
      acc[l.chapter_id].push(l);
      return acc;
    },
    {} as Record<string, { id: string; chapter_id: string; name: string; sort_order: number }[]>
  );

  const questionsByLesson = (questions ?? []).reduce(
    (acc, q) => {
      if (!q.lesson_id) return acc;
      if (!acc[q.lesson_id]) acc[q.lesson_id] = [];
      acc[q.lesson_id].push(q);
      return acc;
    },
    {} as Record<string, { id: string; lesson_id: string; points: number }[]>
  );

  const chapterProgressList: ChapterProgress[] = (chapters ?? [])
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((ch) => {
      const lessons = (lessonsByChapter[ch.id] ?? []).sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
      const lessonItems = lessons.map((lesson) => {
        const lessonQs = questionsByLesson[lesson.id] ?? [];
        let maxP = lessonQs.reduce((s, q) => s + (Number(q.points) || 1), 0);
        let earnedP = lessonQs.reduce(
          (s, q) => s + (bestPointsByQuestion[q.id] ?? 0),
          0
        );
        // Bài không gắn câu hỏi: không cộng điểm giả (tránh hiển thị 1/1 điểm gây hiểu nhầm).
        if (lessonQs.length === 0) {
          maxP = 0;
          earnedP = 0;
        }
        return {
          id: lesson.id,
          name: lesson.name,
          sort_order: lesson.sort_order ?? 0,
          maxPoints: maxP,
          earnedPoints: earnedP,
        };
      });
      const maxPoints = lessonItems.reduce((s, l) => s + l.maxPoints, 0);
      const earnedPoints = lessonItems.reduce((s, l) => s + l.earnedPoints, 0);
      return {
        id: ch.id,
        name: ch.name,
        sort_order: ch.sort_order ?? 0,
        maxPoints,
        earnedPoints,
        lessons: lessonItems,
      };
    });

  const totalLessonMax = chapterProgressList.reduce((s, c) => s + c.maxPoints, 0);
  const totalLessonEarned = chapterProgressList.reduce((s, c) => s + c.earnedPoints, 0);
  const lessonPercentRaw =
    totalLessonMax > 0 ? (totalLessonEarned / totalLessonMax) * 100 : 0;
  const lessonPercentContribution = (lessonPercentRaw / 100) * lessonWeight;

  const { data: finalExam } = await admin
    .from("final_exams")
    .select("id")
    .eq("base_course_id", baseCourseId)
    .single();

  let examPercent = 0;
  let examScoreDisplay: string | null = null;
  let examScoreRaw = 0;
  if (finalExam) {
    const { data: attempts } = await admin
      .from("final_exam_attempts")
      .select("percent_score")
      .eq("enrollment_id", enrollmentId)
      .order("submitted_at", { ascending: false })
      .limit(1);
    const best = attempts?.[0];
    if (best) {
      examScoreRaw = Number(best.percent_score);
      examPercent = (examScoreRaw / 100) * examWeight;
      examScoreDisplay = `${Math.round(examScoreRaw)}% (trọng số ${examWeight}%)`;
    } else {
      examScoreDisplay = `Chưa làm (trọng số ${examWeight}%)`;
    }
  }

  const totalPercent = Math.min(
    100,
    Math.round(lessonPercentContribution + examPercent)
  );

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-[#002b2d]">Tiến độ khóa học</h2>

      {needsPayment && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-900">Chưa thanh toán</p>
          <p className="mt-1 text-sm text-amber-900/90">
            Từ chương 2 và bài thi cuối khóa chỉ mở sau khi bạn hoàn tất thanh toán.
          </p>
          <Link
            href={checkoutUrl}
            className="mt-3 inline-block rounded-full bg-[#002b2d] px-5 py-2 text-sm font-bold text-white hover:bg-[#004144]"
          >
            Thanh toán để tiếp tục học
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600">Tổng điểm khóa học</p>
            <p className="text-3xl font-bold text-[#002b2d]">{totalPercent}%</p>
          </div>
          <Link
            href={`/learn/${enrollmentId}`}
            className="rounded-full bg-[#d14d07] px-5 py-2 text-sm font-bold text-white hover:bg-[#b84306]"
          >
            Tiếp tục học
          </Link>
        </div>

        <div className="mb-8">
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-gray-600">Tổng</span>
            <span className="text-[#002b2d] font-medium">{totalPercent}%</span>
          </div>
          <div className="h-10 overflow-hidden rounded-lg bg-gray-200">
            <div
              className="h-full rounded-lg bg-gradient-to-r from-[#002b2d]/90 to-[#22c55e]/90 transition-all"
              style={{ width: `${totalPercent}%` }}
            />
          </div>
        </div>

        <div className="space-y-6 border-t border-gray-200 pt-6">
          <ProgressSegmentBar
            label="Tổng điểm quá trình học"
            earned={totalLessonEarned}
            max={totalLessonMax}
            percent={lessonPercentRaw}
            barColor="bg-[#002b2d]/80"
            labelEmphasis
          />

          {chapterProgressList.length > 0 && (
            <div className="space-y-6">
            {chapterProgressList.map((ch) => {
              const chPercent =
                ch.maxPoints > 0 ? (ch.earnedPoints / ch.maxPoints) * 100 : 0;
              return (
                <div key={ch.id} className="space-y-3">
                  <ProgressSegmentBar
                    label={ch.name}
                    earned={ch.earnedPoints}
                    max={ch.maxPoints}
                    percent={chPercent}
                    barColor="bg-[#002b2d]/70"
                  />
                  <div className="ml-4 space-y-2 border-l-2 border-gray-200 pl-4">
                    {ch.lessons.map((lesson) => {
                      const lesPercent =
                        lesson.maxPoints > 0
                          ? (lesson.earnedPoints / lesson.maxPoints) * 100
                          : 0;
                      return (
                        <div key={lesson.id}>
                          <ProgressSegmentBar
                            label={lesson.name}
                            earned={lesson.earnedPoints}
                            max={lesson.maxPoints}
                            percent={lesPercent}
                            barColor="bg-[#D4AF37]/70"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            </div>
          )}

          {finalExam && examScoreDisplay && (
            <ProgressSegmentBar
              label="Bài thi cuối khóa"
              earned={Math.round(examScoreRaw)}
              max={100}
              percent={examScoreRaw}
              barColor="bg-[#22c55e]/80"
              displayTextOverride={examScoreDisplay}
              labelEmphasis
            />
          )}
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Bạn cần đạt {Math.round(certificatePassPercent)}% tổng điểm của khóa học để nhận được chứng chỉ.
      </p>

      <Link
        href="/student"
        className="inline-block rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-[#002b2d] hover:bg-gray-50"
      >
        Về Dashboard
      </Link>
    </div>
  );
}
