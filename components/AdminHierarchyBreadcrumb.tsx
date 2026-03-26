import Link from "next/link";
import { Fragment } from "react";

export type AdminBreadcrumbItem = {
  label: string;
  /** Bắt buộc với mọi mục trừ mục cuối (trang hiện tại) */
  href?: string;
};

type AdminHierarchyBreadcrumbProps = {
  items: AdminBreadcrumbItem[];
  className?: string;
};

/**
 * Đường dẫn nhiều cấp cho khu vực Admin (Chương trình › … › trang hiện tại).
 * Mục cuối không có href — hiển thị dạng chữ trắng đậm.
 */
function AdminHierarchyBreadcrumb({ items, className = "" }: AdminHierarchyBreadcrumbProps) {
  if (!items.length) return null;

  const sep = (
    <span className="mx-1.5 shrink-0 text-gray-600" aria-hidden="true">
      ›
    </span>
  );

  return (
    <nav
      aria-label="Đường dẫn quản trị"
      className={`flex flex-wrap items-center gap-y-1 text-sm ${className}`.trim()}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 ? sep : null}
            <span className="inline-flex min-w-0 max-w-full items-center">
              {!isLast && item.href ? (
                <Link
                  href={item.href}
                  className="truncate font-medium text-[#D4AF37] hover:underline"
                  title={item.label}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "truncate font-semibold text-white"
                      : "truncate font-medium text-gray-400"
                  }
                  title={item.label}
                >
                  {item.label}
                </span>
              )}
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}

/** Thanh ngay dưới DashboardNav — tách biệt lớp điều hướng với nội dung trang */
export function AdminBreadcrumbStrip({ items }: { items: AdminBreadcrumbItem[] }) {
  if (!items.length) return null;
  return (
    <div className="border-b border-white/8 bg-[#0a1628]/90">
      <div className="mx-auto max-w-[var(--container-max)] px-4 py-2.5 sm:px-6">
        <AdminHierarchyBreadcrumb items={items} />
      </div>
    </div>
  );
}
