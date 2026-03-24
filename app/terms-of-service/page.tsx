import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabase-server";
import { splitLegalBodyToParagraphs } from "../../lib/legal-content";

export const dynamic = "force-dynamic";

const FALLBACK_INTRO =
  "Văn bản pháp lý điều chỉnh việc sử dụng nền tảng đào tạo ISO/Hệ thống quản lý, bao gồm quyền truy cập học liệu, bảo mật tài khoản và trách nhiệm tuân thủ của học viên.";
const FALLBACK_BODY = "Nội dung đang được cập nhật. Vui lòng quay lại sau.";

export default async function TermsOfServicePage() {
  const supabase = await createServerSupabaseClient();
  const { data: row, error: legalError } = await supabase
    .from("legal_pages")
    .select("intro, body")
    .eq("slug", "terms-of-service")
    .maybeSingle();

  if (legalError) {
    console.error("legal_pages terms:", legalError.message);
  }

  const intro =
    !legalError && row
      ? ((row as { intro?: string | null }).intro?.trim() || FALLBACK_INTRO)
      : FALLBACK_INTRO;
  const bodyRaw =
    !legalError && row
      ? ((row as { body?: string }).body?.trim() || FALLBACK_BODY)
      : FALLBACK_BODY;
  const paragraphs = splitLegalBodyToParagraphs(bodyRaw);
  const displayParas = paragraphs.length > 0 ? paragraphs : [bodyRaw];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),transparent_42%),#081426] px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl rounded-2xl border border-[#D4AF37]/28 bg-[#0f1c33]/88 p-7 shadow-[0_0_35px_rgba(212,175,55,0.16)] md:p-10">
        <p className="text-xs uppercase tracking-[0.22em] text-[#D4AF37]/80">KM Global Academy</p>
        <h1 className="mt-2 font-[family-name:var(--font-serif)] text-3xl font-bold text-[#D4AF37] md:text-5xl">
          Điều khoản sử dụng
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-300">{intro}</p>

        <article className="mt-8 rounded-2xl border border-white/10 bg-[#091327]/75 p-5 md:p-7">
          <div className="space-y-4 text-[15px] leading-8 text-gray-100">
            {displayParas.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </article>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/register"
            className="inline-flex items-center rounded-full border border-[#D4AF37]/70 px-5 py-2.5 text-sm font-semibold text-[#F7E6A8] transition hover:bg-[#D4AF37] hover:text-black"
          >
            Quay lại đăng ký
          </Link>
          <Link
            href="/privacy-policy"
            className="inline-flex items-center rounded-full border border-white/25 px-5 py-2.5 text-sm font-semibold text-gray-200 transition hover:border-[#D4AF37]/60 hover:text-[#F2DD9A]"
          >
            Xem Chính sách bảo mật
          </Link>
        </div>
      </div>
    </main>
  );
}
