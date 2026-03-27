import WhitelistCohortsClient from "./WhitelistCohortsClient";

export const dynamic = "force-dynamic";

export default function OwnerWhitelistPage() {
  return (
    <>
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
