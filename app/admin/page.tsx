import Link from "next/link";
import { createServerSupabaseClient } from "../../lib/supabase-server";
import DashboardNav from "../../components/DashboardNav";
import Footer from "../../components/Footer";

export const dynamic = "force-dynamic";

const modules = [
  {
    title: "Chương trình học",
    desc: "Quản lý chương trình, khóa cơ bản, bài học và khóa thường",
    href: "/admin/programs",
    icon: "📚",
  },
  {
    title: "Khóa học thường",
    desc: "Danh sách khóa mở đăng ký / học, đề nghị xóa khi chưa có học viên",
    href: "/admin/regular-courses",
    icon: "🗓️",
  },
  {
    title: "Thư viện câu hỏi",
    desc: "Quản lý câu hỏi cho bài kiểm tra cuối khóa",
    href: "/admin/question-library",
    icon: "📝",
  },
  {
    title: "Hỏi đáp bài học",
    desc: "Xem và trả lời câu hỏi của học viên theo từng bài",
    href: "/admin/lesson-questions",
    icon: "💬",
  },
];

export default async function AdminDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  const isOwner = (profile as { role?: string } | null)?.role === "owner";

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Admin" />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37] sm:text-3xl">
              Dashboard Admin
            </h1>
            <p className="mt-1.5 text-gray-400">
              Quản lý chương trình học, khóa học và học viên.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isOwner && (
              <Link
                href="/owner"
                className="rounded-full border border-[#D4AF37]/60 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/10"
              >
                Đi tới trang Owner
              </Link>
            )}
            <Link
              href="/"
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-gray-300 transition hover:bg-white/5"
            >
              Về trang chủ
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {modules.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group block rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/5"
            >
              <span className="mb-3 block text-3xl">{m.icon}</span>
              <h2 className="font-semibold text-white transition group-hover:text-[#D4AF37]">
                {m.title}
              </h2>
              <p className="mt-1 text-sm text-gray-400">{m.desc}</p>
            </Link>
          ))}
        </div>
      </main>

      <Footer hideLogo />
    </div>
  );
}
