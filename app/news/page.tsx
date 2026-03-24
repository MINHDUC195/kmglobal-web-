import Link from "next/link";

export const metadata = {
  title: "Tin tức | KM Global Academy",
  description: "Tin tức ISO & IATF mới nhất",
};

export default function NewsPage() {
  return (
    <main className="min-h-screen bg-[#0a1628] px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-bold uppercase text-[#D4AF37]">
          Tin tức ISO & IATF
        </h1>
        <p className="mt-4 text-gray-400">
          Trang tin tức đang được xây dựng. Vui lòng quay lại sau.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
        >
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
