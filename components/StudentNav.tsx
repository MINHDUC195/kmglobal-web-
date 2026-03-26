"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/student", label: "Trang chủ" },
  { href: "/student/questions", label: "Câu hỏi và Trả lời" },
  { href: "/student/certificates", label: "Chứng chỉ" },
  { href: "/student/profile", label: "Hồ sơ" },
];

export default function StudentNav() {
  const pathname = usePathname();
  const [replyCount, setReplyCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadReplyCount() {
      try {
        const res = await fetch("/api/student/questions/reply-count", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled) {
          setReplyCount(Math.max(0, Number(data.count) || 0));
        }
      } catch {
        // Keep default 0 badge when request fails.
      }
    }

    void loadReplyCount();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <nav className="border-b border-white/8 bg-white/[0.02]">
      <div className="mx-auto flex max-w-[var(--container-max)] gap-1 px-4 py-2 sm:px-6">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative rounded-lg px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "bg-[#D4AF37]/10 text-[#D4AF37]"
                  : "text-gray-400 hover:bg-white/5 hover:text-[#D4AF37]"
              }`}
            >
              {item.label}
              {item.href === "/student/questions" && replyCount > 0 && (
                <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                  {replyCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
