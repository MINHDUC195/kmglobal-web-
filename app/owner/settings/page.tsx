import Link from "next/link";

export const dynamic = "force-dynamic";

export default function OwnerSettingsPage() {
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
        Cấu hình
      </h1>
      <p className="mt-2 text-gray-400">
        Chức năng đang được xây dựng. Bạn sẽ được hướng dẫn triển khai chi tiết.
      </p>
    </>
  );
}
