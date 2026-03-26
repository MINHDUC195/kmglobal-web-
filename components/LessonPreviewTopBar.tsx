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
      <div className="w-full px-3 sm:px-6 xl:px-10">
        {/* Row 1: Logo + user actions */}
        <div className="flex items-center justify-between gap-3 py-3 lg:gap-6 lg:py-4">
          <div className="pl-0.5 lg:pl-1">
            <NavLogoWithBanner variant="transparent" scale={0.96} />
          </div>
          <div className="mr-0.5 flex shrink-0 items-center gap-2 rounded-full border border-[#D9E2EC] bg-white/85 px-3 py-1.5 shadow-sm sm:gap-3 sm:px-4">
            <Link
              href="/student"
              className="text-xs font-medium text-[#486581] transition hover:text-[#102A43] sm:text-sm"
            >
              Dashboard
            </Link>
            <span className="hidden text-sm text-[#627D98] lg:inline">
              Xin chào, {displayName}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-[#BCCCDC] bg-white px-3 py-1.5 text-xs font-semibold text-[#102A43] transition hover:bg-[#F0F4F8] sm:px-4 sm:py-2 sm:text-sm"
            >
              Đăng xuất
            </button>
          </div>
        </div>
        {/* Row 2: Breadcrumbs below logo */}
        {children && (
          <div className="border-t border-[#E4E7EB] py-2.5">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
