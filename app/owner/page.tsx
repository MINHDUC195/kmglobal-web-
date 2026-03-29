import Link from "next/link";

export const dynamic = "force-dynamic";

const modules = [
  {
    title: "Quản lý Admin",
    desc: "Thêm, xóa, phân quyền tài khoản admin",
    href: "/owner/admins",
    icon: "👥",
  },
  {
    title: "Quản lý học viên",
    desc: "Danh sách học viên, thông tin đăng ký, mã tự động",
    href: "/owner/students",
    icon: "🎓",
  },
  {
    title: "Quản lý chương trình",
    desc: "Phê duyệt, xóa chương trình đào tạo",
    href: "/owner/programs",
    icon: "📚",
  },
  {
    title: "Phê duyệt khóa học thường",
    desc: "Khóa nhân bản chờ duyệt trước khi hiển thị cho học viên",
    href: "/owner/regular-courses",
    icon: "📋",
  },
  {
    title: "Phê duyệt xóa khóa",
    desc: "Duyệt yêu cầu xóa khóa học thường từ Admin (chưa có học viên)",
    href: "/owner/course-deletions",
    icon: "🗑️",
  },
  {
    title: "Báo cáo",
    desc: "Doanh thu, học viên, thống kê khóa học",
    href: "/owner/reports",
    icon: "📊",
  },
  {
    title: "Hóa đơn VAT",
    desc: "Danh sách giao dịch để đối soát và đánh dấu đã xuất hóa đơn điện tử",
    href: "/owner/invoices",
    icon: "🧾",
  },
  {
    title: "Điều khoản & chính sách",
    desc: "Soạn thảo nội dung hiển thị công khai cho học viên",
    href: "/owner/legal",
    icon: "📜",
  },
  {
    title: "Whitelist đợt đào tạo",
    desc: "Import danh sách, gắn base — một suất miễn phí / học viên / base",
    href: "/owner/whitelist",
    icon: "✅",
  },
];

export default function OwnerDashboardPage() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
            Dashboard Owner
          </h1>
          <p className="mt-1 text-gray-400">
            Quản trị cấp cao: Admin, học viên, báo cáo và chương trình đào tạo.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="rounded-full border border-[#D4AF37]/60 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            Đi tới Admin
          </Link>
          <Link
            href="/"
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
          >
            Về trang chủ
          </Link>
        </div>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="group block rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/5"
          >
            <span className="mb-3 block text-3xl">{m.icon}</span>
            <h2 className="font-semibold text-white group-hover:text-[#D4AF37]">
              {m.title}
            </h2>
            <p className="mt-1 text-sm text-gray-400">{m.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
