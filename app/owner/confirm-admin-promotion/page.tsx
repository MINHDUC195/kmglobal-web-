import Link from "next/link";
import { Suspense } from "react";
import ConfirmAdminPromotionClient from "./ConfirmAdminPromotionClient";

export const dynamic = "force-dynamic";

export default function ConfirmAdminPromotionPage() {
  return (
    <div className="min-h-screen bg-[#0a1628] px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-[var(--container-max)]">
        <Link href="/owner" className="mb-8 inline-block text-sm text-gray-400 hover:text-[#D4AF37]">
          ← Dashboard Owner
        </Link>
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Xác nhận nâng Admin
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          Hoàn tất yêu cầu bạn đã gửi từ trang học viên. Bạn phải đăng nhập bằng đúng tài khoản Owner đã gửi yêu cầu.
        </p>
        <div className="mt-8">
          <Suspense
            fallback={<p className="text-gray-500">Đang tải…</p>}
          >
            <ConfirmAdminPromotionClient />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
