import Link from "next/link";
import DashboardNav from "../../../components/DashboardNav";
import Footer from "../../../components/Footer";

export const dynamic = "force-dynamic";

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Học viên" showExploreCourses />
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
          <h1 className="text-2xl font-bold text-emerald-400">Thanh toán thành công!</h1>
          <p className="mt-2 text-gray-300">
            Khóa học đã được mở khóa. Bạn có thể bắt đầu học ngay.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            (Thanh toán qua MoMo/Stripe: nếu khóa chưa hiện trên trang học, vui lòng đợi vài giây rồi tải lại trang.)
          </p>
          <Link
            href="/student"
            className="mt-6 inline-block rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
          >
            Đến trang học
          </Link>
        </div>
      </main>
      <Footer hideLogo />
    </div>
  );
}
