"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/student", label: "Trang chủ" },
  { href: "/student/certificates", label: "Chứng chỉ" },
  { href: "/student/profile", label: "Hồ sơ" },
];

export default function StudentNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-white/8 bg-white/[0.02]">
      <div className="mx-auto flex max-w-[var(--container-max)] gap-1 px-4 py-2 sm:px-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-[#D4AF37]/10 text-[#D4AF37]"
                  : "text-gray-400 hover:bg-white/5 hover:text-[#D4AF37]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
