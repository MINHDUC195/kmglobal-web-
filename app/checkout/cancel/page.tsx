import Link from "next/link";
import DashboardNav from "../../../components/DashboardNav";
import Footer from "../../../components/Footer";

export const dynamic = "force-dynamic";

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Học viên" showExploreCourses />
      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
          <h1 className="text-2xl font-bold text-amber-400">Đã hủy thanh toán</h1>
          <p className="mt-2 text-gray-300">
            Bạn đã hủy giao dịch. Khóa học chưa được mua. Bạn có thể quay lại và thanh toán bất cứ lúc nào.
          </p>
          <Link
            href="/courses"
            className="mt-6 inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            Khám phá khóa học
          </Link>
        </div>
      </main>
      <Footer hideLogo />
    </div>
  );
}
