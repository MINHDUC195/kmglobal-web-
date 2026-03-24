import Link from "next/link";

export const metadata = {
  title: "Tài khoản bị khóa | KM Global",
};

export default function AccountLockedPage() {
  return (
    <div className="min-h-screen bg-[#0a1628] px-4 py-16 text-white">
      <div className="mx-auto max-w-lg rounded-2xl border border-[#D4AF37]/40 bg-[#001529]/80 p-8 text-center shadow-xl">
        <h1 className="font-serif text-2xl font-bold text-[#D4AF37]">Tài khoản đã bị khóa</h1>
        <p className="mt-4 text-sm leading-relaxed text-white/85">
          Tài khoản của bạn đã bị tạm khóa do vi phạm quy định hủy đăng ký (ví dụ hủy quá số lần cho phép
          khi chưa hoàn tất thanh toán). Chỉ Owner hệ thống có thể mở khóa.
        </p>
        <p className="mt-3 text-sm text-white/70">
          Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ bộ phận hỗ trợ của doanh nghiệp.
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
