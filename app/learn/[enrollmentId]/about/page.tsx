import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getActiveLearnEnrollmentForUser } from "../../../../lib/get-active-learn-enrollment";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import CancelEnrollmentButton from "../../../../components/CancelEnrollmentButton";

export const dynamic = "force-dynamic";

type AboutPageProps = {
  params: Promise<{ enrollmentId: string }>;
};

export default async function LearnAboutPage({ params }: AboutPageProps) {
  const { enrollmentId } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const enrollment = await getActiveLearnEnrollmentForUser(enrollmentId, user.id);
  if (!enrollment) notFound();

  const admin = getSupabaseAdminClient();
  const { data: certificateRow } = await admin
    .from("certificates")
    .select("id")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();
  const hasCertificate = Boolean(certificateRow);

  const baseCourse = (enrollment.regular_course as {
    base_course?: {
      id?: string;
      name?: string;
      code?: string;
      summary?: string | null;
      objectives?: string | null;
      difficulty_level?: string | null;
      prerequisite?: string | null;
    };
  } | null)?.base_course;

  const courseName = (enrollment.regular_course as { name?: string } | null)?.name ?? baseCourse?.name ?? "Khóa học";

  return (
    <div className="space-y-6">
      <h2 className="font-semibold text-[#002b2d]">Giới thiệu khóa học</h2>

      <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <section>
          <h3 className="font-semibold text-[#002b2d]">Tổng quan</h3>
          <p className="mt-2 whitespace-pre-wrap text-gray-600">
            {baseCourse?.summary || "Chưa có mô tả khóa học."}
          </p>
        </section>

        {baseCourse?.objectives && (
          <section>
            <h3 className="font-semibold text-[#002b2d]">Mục tiêu học tập</h3>
            <div className="mt-2 whitespace-pre-wrap text-gray-600">
              {baseCourse.objectives}
            </div>
          </section>
        )}

        {(baseCourse?.difficulty_level || baseCourse?.prerequisite) && (
          <section className="flex flex-wrap gap-6">
            {baseCourse?.difficulty_level && (
              <div>
                <p className="text-sm text-gray-500">Độ khó</p>
                <p className="font-medium text-gray-800">{baseCourse.difficulty_level}</p>
              </div>
            )}
            {baseCourse?.prerequisite && (
              <div>
                <p className="text-sm text-gray-500">Điều kiện tiên quyết</p>
                <p className="font-medium text-gray-800">{baseCourse.prerequisite}</p>
              </div>
            )}
          </section>
        )}

        {baseCourse?.code && (
          <p className="text-sm text-gray-500">
            Mã khóa học: <span className="font-mono text-[#002b2d]">{baseCourse.code}</span>
          </p>
        )}
      </div>

      <Link
        href={`/learn/${enrollmentId}`}
        className="inline-block rounded-full bg-[#002b2d] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#004144]"
      >
        Bắt đầu học
      </Link>

      <Link
        href="/student"
        className="ml-4 inline-block rounded-full border border-gray-300 px-6 py-2.5 text-sm font-semibold text-[#002b2d] hover:bg-gray-50"
      >
        Về Dashboard
      </Link>

      {!hasCertificate && (
        <div className="mt-12 border-t border-gray-200 pt-8">
          <h3 className="font-semibold text-[#002b2d]">Hủy đăng ký</h3>
          <p className="mt-2 text-sm text-gray-600">
            Nếu bạn không thể tiếp tục học, bạn có thể hủy đăng ký tại đây.
          </p>
          <div className="mt-4">
            <CancelEnrollmentButton
              enrollmentId={enrollmentId}
              courseName={courseName}
            />
          </div>
        </div>
      )}
    </div>
  );
}
