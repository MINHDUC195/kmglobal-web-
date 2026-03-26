"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import NavLogoWithBanner from "./NavLogoWithBanner";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { useEffect, useState } from "react";

type LessonPreviewTopBarProps = {
  /** Breadcrumb component (LessonBreadcrumbs) - optional */
  children?: React.ReactNode;
};

export default function LessonPreviewTopBar({ children }: LessonPreviewTopBarProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [displayName, setDisplayName] = useState("bạn");

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", data.user.id)
        .single();
      const name = (profile as { full_name?: string } | null)?.full_name?.trim();
      if (name) setDisplayName(name);
    }
    void loadProfile();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-[#D9E2EC] bg-[#F8FAFC]">
      <div className="mx-auto max-w-[var(--container-max)] px-4 sm:px-6">
        {/* Row 1: Logo + user actions */}
        <div className="flex items-center justify-between gap-4 py-3">
          <NavLogoWithBanner variant="light" />
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/student"
              className="text-sm text-[#486581] hover:text-[#102A43]"
            >
              Dashboard
            </Link>
            <span className="hidden text-sm text-[#627D98] sm:inline">
              Xin chào, {displayName}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-[#BCCCDC] px-4 py-2 text-sm font-semibold text-[#102A43] hover:bg-[#F0F4F8]"
            >
              Đăng xuất
            </button>
          </div>
        </div>
        {/* Row 2: Breadcrumbs below logo */}
        {children && (
          <div className="border-t border-[#E4E7EB] py-2">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
