import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBreadcrumbStrip } from "../../../../components/AdminHierarchyBreadcrumb";
import RegularCourseSubmitApprovalButton from "../../../../components/RegularCourseSubmitApprovalButton";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getCourseDisplayStatus } from "../../../../lib/course-status";

type RegularCoursePageProps = {
  params: Promise<{ id: string }>;
};

export default async function RegularCoursePage({ params }: RegularCoursePageProps) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: course, error } = await supabase
    .from("regular_courses")
    .select(`
      *,
      base_course:base_courses(id, name, code),
      program:programs(id, name)
    `)
    .eq("id", id)
    .single();

  const displayStatus = course
    ? getCourseDisplayStatus(
        course.registration_open_at,
        course.registration_close_at,
        course.course_end_at
      )
    : null;

  if (error || !course) {
    notFound();
  }

  const baseCourse = course.base_course as { id: string; name: string; code: string } | null;
  const program = course.program as { id: string; name: string } | null;
  const approvalStatus =
    (course as { approval_status?: string | null }).approval_status ?? "pending";
  const regularBreadcrumb = [
    { label: "Chương trình", href: "/admin/programs" },
    ...(program?.id
      ? [{ label: program.name || "Chương trình", href: `/admin/programs/${program.id}` }]
      : []),
    ...(baseCourse?.id
      ? [{ label: baseCourse.name || "Khóa học cơ bản", href: `/admin/base-courses/${baseCourse.id}` }]
      : []),
    { label: course.name ?? "Khóa học thường" },
  ];

  return (
    <>
      <AdminBreadcrumbStrip items={regularBreadcrumb} />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
            {course.name}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Khóa thường · Clone từ: {baseCourse?.name ?? "-"} · Trạng thái: {displayStatus ?? "-"}
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 font-semibold text-white">Thông tin khóa học thường</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-400 w-40">Giá:</dt>
              <dd className="text-white">
                {course.price_cents == null
                  ? "Chưa đặt"
                  : Number(course.price_cents) === 0
                    ? "Miễn phí"
                    : course.discount_percent != null && course.discount_percent >= 1
                      ? (
                          <>
                            <span className="line-through text-gray-500">
                              {Number(course.price_cents).toLocaleString("vi-VN")} ₫
                            </span>
                            <span className="ml-2">
                              {Math.round((Number(course.price_cents) * (100 - course.discount_percent)) / 100).toLocaleString("vi-VN")} ₫
                            </span>
                            <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                              -{course.discount_percent}%
                            </span>
                          </>
                        )
                      : `${Number(course.price_cents).toLocaleString("vi-VN")} ₫`}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-400 w-40">Mở đăng ký:</dt>
              <dd className="text-white">
                {course.registration_open_at
                  ? new Date(course.registration_open_at).toLocaleDateString("vi-VN")
                  : "-"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-400 w-40">Đóng đăng ký:</dt>
              <dd className="text-white">
                {course.registration_close_at
                  ? new Date(course.registration_close_at).toLocaleDateString("vi-VN")
                  : "-"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-400 w-40">Bắt đầu khóa:</dt>
              <dd className="text-white">
                {course.course_start_at
                  ? new Date(course.course_start_at).toLocaleDateString("vi-VN")
                  : "-"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-400 w-40">Kết thúc khóa:</dt>
              <dd className="text-white">
                {course.course_end_at
                  ? new Date(course.course_end_at).toLocaleDateString("vi-VN")
                  : "-"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap items-start gap-3">
          <Link
            href={`/admin/regular-courses/${id}/edit`}
            className="inline-block rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
          >
            Chỉnh sửa
          </Link>
          <RegularCourseSubmitApprovalButton courseId={id} approvalStatus={approvalStatus} />
          <Link
            href="/admin/regular-courses"
            className="inline-flex items-center rounded-full border border-white/25 px-6 py-2.5 text-sm font-semibold text-gray-200 hover:border-[#D4AF37]/50"
          >
            ← Danh sách khóa thường
          </Link>
        </div>

        {baseCourse && (
          <Link
            href={`/admin/base-courses/${baseCourse.id}`}
            className="mt-4 inline-block text-sm text-[#D4AF37] hover:underline"
          >
            Xem khóa cơ bản gốc →
          </Link>
        )}
      </main>
    </>
  );
}
