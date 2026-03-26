"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import type { ProfileHeaderSnippet } from "../types/database";

const supabase = getSupabaseBrowserClient();

export default function HeaderAuthControls() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [dashboardHref, setDashboardHref] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function applySession(session: Session | null) {
      try {
        const user = session?.user ?? null;
        if (!user) {
          setCurrentUserId(null);
          setCurrentUserName("");
          setDashboardHref(null);
          return;
        }

        setCurrentUserId(user.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();

        if (cancelled) return;

        const profileData = profile as ProfileHeaderSnippet | null;
        setCurrentUserName(profileData?.full_name?.trim() || "bạn");
        if (profileData?.role === "owner") setDashboardHref("/owner");
        else if (profileData?.role === "admin") setDashboardHref("/admin");
        else setDashboardHref("/student");
      } catch (err) {
        if (cancelled) return;
        setCurrentUserId(null);
        setCurrentUserName("");
        setDashboardHref(null);
        console.warn("[HeaderAuthControls] Lỗi kết nối Supabase:", err);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      void applySession(session);
    });

    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) await applySession(session);
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setCurrentUserId(null);
    setCurrentUserName("");
  }

  if (!currentUserId) {
    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
        <Link
          href="/login"
          className="rounded-full border border-white/25 px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:border-[#D4AF37]/60 hover:text-[#D4AF37] sm:px-4 sm:py-2 sm:text-sm"
        >
          Đăng nhập
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-black shadow-[0_0_10px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:shadow-[0_0_18px_rgba(212,175,55,0.5)] sm:px-5 sm:py-2 sm:text-sm"
        >
          Đăng ký
        </Link>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:gap-3">
      {dashboardHref && (
        <Link
          href={dashboardHref}
          className="truncate px-1 py-1 text-xs font-medium text-white/80 transition-colors hover:text-[#D4AF37] sm:px-3 sm:py-2 sm:text-sm"
        >
          Dashboard
        </Link>
      )}
      <span className="max-w-[9rem] truncate px-0.5 text-xs font-semibold text-white/85 sm:max-w-none sm:px-2 sm:text-sm">
        Chào, {currentUserName}
      </span>
      <button
        type="button"
        onClick={handleSignOut}
        className="rounded-full bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-black shadow-[0_0_10px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:shadow-[0_0_18px_rgba(212,175,55,0.5)] sm:px-5 sm:py-2 sm:text-sm"
      >
        Đăng xuất
      </button>
    </div>
  );
}
