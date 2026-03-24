"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type LearnNavTabsProps = {
  enrollmentId: string;
};

const TABS = [
  { href: (id: string) => `/learn/${id}`, label: "Nội dung" },
  { href: (id: string) => `/learn/${id}/progress`, label: "Tiến độ" },
  { href: (id: string) => `/learn/${id}/about`, label: "Giới thiệu" },
] as const;

export default function LearnNavTabs({ enrollmentId }: LearnNavTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="mt-4 flex gap-6 border-b border-gray-200">
      {TABS.map((tab) => {
        const href = tab.href(enrollmentId);
        const isActive = pathname === href || (tab.label === "Nội dung" && pathname === `/learn/${enrollmentId}`);
        return (
          <Link
            key={tab.label}
            href={href}
            className={`border-b-2 pb-3 text-sm font-medium transition ${
              isActive
                ? "border-[#002b2d] text-[#002b2d]"
                : "border-transparent text-gray-500 hover:text-[#002b2d]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
