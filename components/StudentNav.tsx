"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  computeUnreadCount,
  getSeenChangedEventName,
  markAllQuestionsSeen,
  type QuestionReplySummaryItem,
} from "../lib/student-question-notifications";

const navItems = [
  { href: "/student", label: "Trang chủ" },
  { href: "/student/questions", label: "Câu hỏi và Trả lời" },
  { href: "/student/certificates", label: "Chứng chỉ" },
  { href: "/student/profile", label: "Hồ sơ" },
];

export default function StudentNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [replySummary, setReplySummary] = useState<QuestionReplySummaryItem[]>([]);
  const replyCount = useMemo(() => computeUnreadCount(replySummary), [replySummary]);

  useEffect(() => {
    let mounted = true;

    navItems.forEach((item) => {
      router.prefetch(item.href);
    });

    async function loadReplySummary() {
      try {
        const res = await fetch("/api/student/questions/reply-count", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: QuestionReplySummaryItem[] };
        if (mounted) {
          setReplySummary(data.items ?? []);
        }
      } catch {
        if (mounted) setReplySummary([]);
      }
    }

    void loadReplySummary();

    const seenEventName = getSeenChangedEventName();
    const handleSeenChanged = () => {
      if (!mounted) return;
      setReplySummary((prev) => [...prev]);
    };
    window.addEventListener(seenEventName, handleSeenChanged);

    return () => {
      mounted = false;
      window.removeEventListener(seenEventName, handleSeenChanged);
    };
  }, [router]);

  function handleQuestionsNavClick() {
    markAllQuestionsSeen(replySummary);
  }

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
              onClick={item.href === "/student/questions" ? handleQuestionsNavClick : undefined}
            >
              <span>{item.label}</span>
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
