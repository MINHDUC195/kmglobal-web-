import Link from "next/link";
import NavLogoWithBanner from "./NavLogoWithBanner";

type FooterProps = {
  /** Ẩn logo trong footer (dùng cho trang có layout khác) */
  hideLogo?: boolean;
  /** light = nền trắng, viền xám (trang learn preview) */
  variant?: "dark" | "light";
};

export default function Footer({ hideLogo = false, variant = "dark" }: FooterProps) {
  const isLight = variant === "light";
  return (
    <footer
      className={`relative z-10 py-10 sm:py-12 ${
        isLight ? "border-t border-gray-200 bg-white" : "border-t border-white/10"
      }`}
    >
      <div className="mx-auto max-w-[var(--container-max)] px-4 sm:px-6">
        <div className="flex items-center justify-between gap-8">
          {!hideLogo && <NavLogoWithBanner scale={1.3} />}
          <div className={`flex flex-wrap items-center gap-6 text-sm ${hideLogo ? "justify-center" : "justify-end"} ${isLight ? "text-gray-600" : "text-gray-400"}`}>
            <Link href="/courses" className={isLight ? "hover:text-[#002b2d]" : "hover:text-[#D4AF37]"}>
              Khóa học
            </Link>
            <Link href="/verify" className={isLight ? "hover:text-[#002b2d]" : "hover:text-[#D4AF37]"}>
              Xác minh chứng chỉ
            </Link>
            <Link href="/terms-of-service" className={isLight ? "hover:text-[#002b2d]" : "hover:text-[#D4AF37]"}>
              Điều khoản
            </Link>
            <Link href="/privacy-policy" className={isLight ? "hover:text-[#002b2d]" : "hover:text-[#D4AF37]"}>
              Bảo mật
            </Link>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-gray-500">
          © Công ty TNHH KM Global
          <br />
          Tầng 12, Tòa nhà Licogi13, Phường Thanh Xuân, Hà Nội · Mã số Thuế 0109786529
          <br />
          Tuyên bố quyền sở hữu và trách nhiệm.
        </p>
      </div>
    </footer>
  );
}
