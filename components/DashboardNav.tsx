"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavLogoWithBanner from "./NavLogoWithBanner";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type DashboardNavProps = {
  /** Fallback khi chưa load xong profile */
  greeting?: string;
  /** Tên từ server (layout) — tránh fetch thêm profile trên client */
  initialDisplayName?: string | null;
  /** Link "Khám phá khóa học" - chỉ hiện cho student */
  showExploreCourses?: boolean;
  /** Admin được promote: vào khu học viên */
  showStudentHubLink?: boolean;
  /** Đang ở khu học viên nhưng là admin có hub → về quản trị */
  showAdminHubLink?: boolean;
  /** Trên /admin khi user là owner */
  showOwnerHubLink?: boolean;
};

export default function DashboardNav({
  greeting = "bạn",
  initialDisplayName,
  showExploreCourses = false,
  showStudentHubLink = false,
  showAdminHubLink = false,
  showOwnerHubLink = false,
}: DashboardNavProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [displayName, setDisplayName] = useState(() =>
    initialDisplayName != null
      ? (String(initialDisplayName).trim() || greeting)
      : greeting
  );

  useEffect(() => {
    if (initialDisplayName != null) return;
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
  }, [supabase, initialDisplayName]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="border-b border-white/8 bg-[#0a1628]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[var(--container-max)] items-center justify-between px-4 py-3 sm:px-6">
        <NavLogoWithBanner />
        <div className="flex flex-wrap items-center gap-3">
          {showOwnerHubLink && (
            <Link
              href="/owner"
              className="text-sm font-medium text-[#D4AF37] hover:underline"
            >
              Khu Owner
            </Link>
          )}
          {showStudentHubLink && (
            <Link
              href="/student"
              className="text-sm font-medium text-emerald-300 hover:underline"
            >
              Khu học viên
            </Link>
          )}
          {showAdminHubLink && (
            <Link
              href="/admin"
              className="text-sm font-medium text-[#D4AF37] hover:underline"
            >
              Quản trị
            </Link>
          )}
          {showExploreCourses && (
            <Link
              href="/courses"
              className="text-sm font-medium text-[#D4AF37] hover:underline"
            >
              Khám phá khóa học
            </Link>
          )}
          <span className="text-sm text-gray-400">Xin chào, {displayName}</span>
          <button
            onClick={handleSignOut}
            className="rounded-full border border-[#D4AF37]/50 px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </nav>
  );
}
