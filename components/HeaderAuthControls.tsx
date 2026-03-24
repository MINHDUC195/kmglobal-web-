"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import type { ProfileRow } from "../types/database";

const supabase = getSupabaseBrowserClient();

export default function HeaderAuthControls() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [dashboardHref, setDashboardHref] = useState<string | null>(null);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        setCurrentUserId(user?.id ?? null);

        if (!user) {
          setCurrentUserName("");
          setDashboardHref(null);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();

        const profileData = profile as Pick<ProfileRow, "full_name" | "role"> | null;
        setCurrentUserName(profileData?.full_name?.trim() || "bạn");
        if (profileData?.role === "owner") setDashboardHref("/owner");
        else if (profileData?.role === "admin") setDashboardHref("/admin");
        else setDashboardHref("/student");
      } catch (err) {
        setCurrentUserId(null);
        setCurrentUserName("");
        setDashboardHref(null);
        console.warn("[HeaderAuthControls] Lỗi kết nối Supabase:", err);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadCurrentUser();
    });

    void loadCurrentUser();
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setCurrentUserId(null);
    setCurrentUserName("");
  }

  if (!currentUserId) {
    return (
      <>
        <Link
          href="/login"
          className="hidden bg-transparent px-4 py-2 text-sm font-semibold tracking-wide text-white/80 transition-colors hover:text-[#D4AF37] sm:block"
        >
          Đăng nhập
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-bold text-black shadow-[0_0_10px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-[0_0_18px_rgba(212,175,55,0.5)]"
        >
          Đăng ký
        </Link>
      </>
    );
  }

  return (
    <>
      {dashboardHref && (
        <Link
          href={dashboardHref}
          className="hidden px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:text-[#D4AF37] sm:block"
        >
          Dashboard
        </Link>
      )}
      <span className="hidden px-2 text-sm font-semibold text-white/85 sm:block">
        Chào, {currentUserName}
      </span>
      <button
        onClick={handleSignOut}
        className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-bold text-black shadow-[0_0_10px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-105 hover:bg-white hover:shadow-[0_0_18px_rgba(212,175,55,0.5)]"
      >
        Đăng xuất
      </button>
    </>
  );
}
