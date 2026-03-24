import Link from "next/link";

export const metadata = {
  title: "Tài khoản tạm khóa | KM Global",
};

export default function AccountTempLockedPage() {
  return (
    <div className="min-h-screen bg-[#0a1628] px-4 py-16 text-white">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#D4AF37]/40 bg-[#001529]/80 p-8 text-center shadow-xl">
        <h1 className="font-serif text-2xl font-bold text-[#D4AF37]">Tài khoản đang tạm khóa</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/85">
          Bạn đã yêu cầu tạm khóa tài khoản trong 3 ngày. Trong thời gian này bạn không thể truy cập khu
          vực học viên. Sau khi hết hạn, hệ thống sẽ tự mở lại và bạn có thể đăng nhập bình thường.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-full border border-[#D4AF37] bg-[#D4AF37]/10 px-8 py-3 text-sm font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/20"
        >
          Quay lại đăng nhập
        </Link>
      </div>
    </div>
  );
}
