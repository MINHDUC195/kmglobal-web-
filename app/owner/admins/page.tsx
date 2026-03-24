import Link from "next/link";
import AdminManager from "./AdminManager";

export const dynamic = "force-dynamic";

export default function OwnerAdminsPage() {
  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/owner"
          className="text-sm text-gray-400 hover:text-[#D4AF37]"
        >
          ← Dashboard Owner
        </Link>
      </div>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Quản lý Admin
      </h1>
      <p className="mt-2 text-gray-400">
        Thêm admin mới, nhập thông tin và phân quyền soạn thảo nội dung chương trình đào tạo. Hệ thống sẽ gửi email xác nhận cho admin; họ cần click link, đồng ý điều khoản rồi đăng nhập.
      </p>
      <AdminManager />
    </>
  );
}
