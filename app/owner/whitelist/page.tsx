import Link from "next/link";
import WhitelistCohortsClient from "./WhitelistCohortsClient";

export const dynamic = "force-dynamic";

export default function OwnerWhitelistPage() {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href="/owner" className="text-sm text-gray-400 hover:text-[#D4AF37]">
          ← Dashboard Owner
        </Link>
        <span className="text-gray-600">|</span>
        <Link href="/owner/reports" className="text-sm text-gray-400 hover:text-[#D4AF37]">
          Báo cáo tổng hợp
        </Link>
        <span className="text-gray-600">|</span>
        <Link href="/owner/invoices" className="text-sm text-gray-400 hover:text-[#D4AF37]">
          Hóa đơn VAT
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Whitelist đợt đào tạo
        </h1>
        <p className="mt-1 text-gray-400">
          Danh sách học viên được miễn phí theo khóa cơ bản (không dùng domain). Ưu tiên trước miễn phí theo tên miền tổ chức. Owner không áp dụng suất whitelist. Clone khóa thường cùng base: khoảng đăng ký và khoảng ngày khóa không được trùng (đã kiểm tra ở database).
        </p>
      </div>
      <WhitelistCohortsClient />
    </>
  );
}
