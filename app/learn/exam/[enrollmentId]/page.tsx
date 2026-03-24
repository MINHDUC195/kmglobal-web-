import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminBreadcrumbItem } from "../../../../components/AdminHierarchyBreadcrumb";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { isCourseExpiredUncompleted } from "../../../../lib/course-expired-uncompleted";
import { resolveEnrollmentPaymentAccess } from "../../../../lib/enrollment-payment-status";
import FinalExamClient from "./FinalExamClient";

export const dynamic = "force-dynamic";

type ExamPageProps = {
  params: Promise<{ enrollmentId: string }>;
};

export default async function ExamPage({ params }: ExamPageProps) {
  const { enrollmentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const admin = getSupabaseAdminClient();

  const { data: enrollment, error: eErr } = await admin
    .from("enrollments")
    .select(`
      id,
      payment_id,
      regular_course_id,
      regular_course:regular_courses(id, name, price_cents, discount_percent, base_course:base_courses(id))
    `)
    .eq("id", enrollmentId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (eErr || !enrollment) notFound();

  const baseCourseId = (enrollment.regular_course as { base_course?: { id?: string } } | null)?.base_course?.id;
  if (!baseCourseId) notFound();

  const rcForPay = enrollment.regular_course as {
    price_cents?: number | null;
    discount_percent?: number | null;
  } | null;
  const { needsPayment } = await resolveEnrollmentPaymentAccess(admin, {
    payment_id: enrollment.payment_id,
    regular_course: rcForPay ?? null,
  });

  const expiredUncompleted = await isCourseExpiredUncompleted(admin, enrollmentId);

  const { count: attemptCount } = await admin
    .from("final_exam_attempts")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", enrollmentId);
  const { data: existingCert } = await admin
    .from("certificates")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();
  const noMoreAttempts = !existingCert && (attemptCount ?? 0) >= 2;

  if (needsPayment) {
    const courseName = (enrollment.regular_course as { name?: string } | null)?.name ?? "Khóa học";
    const checkoutUrl = `/checkout?courseId=${enrollment.regular_course_id}`;
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-amber-500/50 bg-amber-50 p-8 text-center">
          <h1 className="text-xl font-semibold text-amber-900">
            Cần thanh toán để làm bài thi cuối khóa
          </h1>
          <p className="mt-3 text-sm text-amber-800">
            Khóa học trả phí: sau khi hoàn tất thanh toán, bạn được học từ chương 2 và làm bài thi cuối khóa để xét chứng chỉ.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={checkoutUrl}
              className="inline-block rounded-full bg-[#002b2d] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#004144]"
            >
              Thanh toán ngay
            </Link>
            <Link
              href={`/learn/${enrollmentId}`}
              className="inline-block rounded-full border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-[#002b2d] hover:bg-gray-50"
            >
              ← Về {courseName}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (expiredUncompleted) {
    const courseName = (enrollment.regular_course as { name?: string } | null)?.name ?? "Khóa học";
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-amber-500/50 bg-amber-50 p-8 text-center">
          <h1 className="text-xl font-semibold text-amber-800">
            Thi cuối kỳ đã bị khóa
          </h1>
          <p className="mt-3 text-sm text-amber-700">
            Khóa học đã kết thúc và bạn chưa hoàn thành đúng hạn. Bạn vẫn có thể xem nội dung khóa học nhưng không thể làm bài thi cuối hay nhận chứng chỉ.
          </p>
          <Link
            href={`/learn/${enrollmentId}`}
            className="mt-6 inline-block rounded-full bg-[#002b2d] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#004144]"
          >
            ← Về khóa học {courseName}
          </Link>
        </div>
      </div>
    );
  }

  if (noMoreAttempts) {
    const courseName = (enrollment.regular_course as { name?: string } | null)?.name ?? "Khóa học";
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-amber-500/50 bg-amber-50 p-8 text-center">
          <h1 className="text-xl font-semibold text-amber-800">
            Bạn đã hết 2 lần thi
          </h1>
          <p className="mt-3 text-sm text-amber-700">
            Bạn đã sử dụng đủ 2 lần thi cuối khóa. Nếu muốn đăng ký lại để lấy chứng chỉ, vui lòng hủy đăng ký khóa cũ trước.
          </p>
          <Link
            href={`/learn/${enrollmentId}`}
            className="mt-6 inline-block rounded-full bg-[#002b2d] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#004144]"
          >
            ← Về khóa học {courseName}
          </Link>
        </div>
      </div>
    );
  }

  const { data: finalExam } = await admin
    .from("final_exams")
    .select("id, name")
    .eq("base_course_id", baseCourseId)
    .limit(1)
    .single();

  if (!finalExam) notFound();

  const courseName = (enrollment.regular_course as { name?: string } | null)?.name ?? "Khóa học";

  const examBreadcrumb: AdminBreadcrumbItem[] = [
    { label: courseName, href: `/learn/${enrollmentId}` },
    { label: (finalExam.name as string) || "Bài thi cuối khóa" },
  ];

  return (
    <FinalExamClient
      enrollmentId={enrollmentId}
      finalExamId={finalExam.id}
      examName={finalExam.name as string}
      courseName={courseName}
      breadcrumbItems={examBreadcrumb}
    />
  );
}
