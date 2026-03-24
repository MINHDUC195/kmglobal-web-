import Link from "next/link";
import LogoDownloadCard from "../../components/LogoDownloadCard";

export const metadata = {
  title: "Tải logo | KM Global Academy",
  description: "Tải logo KM Global Academy (SVG, PNG) để sử dụng trong catalog và tài liệu.",
};

export default function LogoDownloadPage() {
  return (
    <div className="min-h-screen bg-[#0a1628] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="mb-6 inline-block text-sm text-[#D4AF37] hover:underline">
          ← Về trang chủ
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-white">
          KM Global Academy — Logo cho catalog
        </h1>
        <p className="mb-8 text-gray-400">
          Chọn logo và tải xuống định dạng SVG (vector) hoặc PNG để sử dụng trong tài liệu, catalog.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <LogoDownloadCard
            title="1. Logo đơn giản"
            desc="Icon + KM GLOBAL ACADEMY"
            src="/logo-kmglobal-academy.svg"
            pngSrc="/logo-kmglobal-academy.png"
            svgFilename="kmglobal-academy-logo.svg"
            pngFilename="kmglobal-academy-logo.png"
            imgId="logo-simple"
          />
          <LogoDownloadCard
            title="2. Logo đầy đủ (có tagline)"
            desc="Logo + Nền tảng đào tạo hàng đầu"
            src="/logo-kmglobal-academy-full.svg"
            pngSrc="/logo-kmglobal-academy-full.png"
            svgFilename="kmglobal-academy-logo-full.svg"
            pngFilename="kmglobal-academy-logo-full.png"
            imgId="logo-full"
          />
        </div>
      </div>
    </div>
  );
}
