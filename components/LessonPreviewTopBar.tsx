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
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-[var(--container-max)] px-4 sm:px-6">
        {/* Row 1: Logo + user actions */}
        <div className="flex items-center justify-between gap-4 py-3">
          <NavLogoWithBanner variant="light" />
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/student"
              className="text-sm text-gray-600 hover:text-[#002b2d]"
            >
              Dashboard
            </Link>
            <span className="hidden text-sm text-gray-500 sm:inline">
              Xin chào, {displayName}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-[#002b2d] hover:bg-gray-50"
            >
              Đăng xuất
            </button>
          </div>
        </div>
        {/* Row 2: Breadcrumbs below logo */}
        {children && (
          <div className="border-t border-gray-100 py-2">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
