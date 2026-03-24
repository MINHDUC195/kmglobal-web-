import Link from "next/link";
import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function StudentCertificatesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  const { data: certificates } = await admin
    .from("certificates")
    .select(`
      id,
      code,
      percent_score,
      issued_at,
      regular_course:regular_courses(name),
      base_course:base_courses(name, code)
    `)
    .eq("user_id", user.id)
    .order("issued_at", { ascending: false });

  const list =
    certificates?.map((c) => ({
      id: c.id,
      code: c.code,
      percentScore: c.percent_score,
      issuedAt: c.issued_at,
      courseName:
        (c.regular_course as { name?: string } | null)?.name ??
        (c.base_course as { name?: string } | null)?.name ??
        "Khóa học",
      courseCode: (c.base_course as { code?: string } | null)?.code ?? "",
    })) ?? [];

  return (
    <>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Chứng chỉ của tôi
      </h1>
      <p className="mt-2 text-gray-400">
        Các chứng chỉ bạn đã nhận sau khi hoàn thành khóa học và đạt ≥ 70% bài thi cuối.
      </p>

      {list.length > 0 ? (
        <div className="mt-8 space-y-4">
          {list.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-6 py-5 transition hover:bg-white/10"
            >
              <div>
                <p className="font-medium text-white">{c.courseName}</p>
                <p className="mt-1 text-sm text-gray-400">
                  Mã chứng chỉ: <span className="font-mono text-[#D4AF37]">{c.code}</span>
                </p>
                <p className="mt-0.5 text-sm text-gray-500">
                  Điểm: {c.percentScore}% · Cấp ngày:{" "}
                  {c.issuedAt
                    ? new Date(c.issuedAt).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "-"}
                </p>
              </div>
              <Link
                href={`/verify?code=${encodeURIComponent(c.code)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-full border border-[#D4AF37]/60 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                Xem / Xác minh
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-gray-400">
            Bạn chưa có chứng chỉ nào. Hoàn thành khóa học và đạt ≥ 70% bài thi cuối để nhận chứng chỉ.
          </p>
          <Link
            href="/student"
            className="mt-4 inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            Về trang chủ
          </Link>
        </div>
      )}
    </>
  );
}
