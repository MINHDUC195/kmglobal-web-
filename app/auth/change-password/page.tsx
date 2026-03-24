"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import NavLogoWithBanner from "../../../components/NavLogoWithBanner";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";
import { validatePasswordStrength } from "../../../lib/password-policy";

function ChangePasswordContent() {
  const searchParams = useSearchParams();
  const to = searchParams.get("to") || "/admin";
  const required = searchParams.get("required") === "1";
  const safeTo = to.startsWith("/") && !to.startsWith("//") ? to : "/admin";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let cancelled = false;

    function redirectToLogin() {
      const qs = new URLSearchParams();
      if (required) qs.set("required", "1");
      qs.set("to", safeTo);
      const returnTo = `/auth/change-password?${qs.toString()}`;
      window.location.href = `/login?reason=not-authenticated&to=${encodeURIComponent(returnTo)}`;
    }

    const hasRecoverySignal =
      typeof window !== "undefined" &&
      (window.location.search.includes("code=") ||
        window.location.search.includes("type=recovery") ||
        window.location.hash.includes("access_token") ||
        window.location.hash.includes("type=recovery"));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (cancelled) return;
      if (session?.user) {
        setChecking(false);
      }
    });

    void (async () => {
      const { data: s1 } = await supabase.auth.getSession();
      if (cancelled) return;
      if (s1.session?.user) {
        setChecking(false);
        return;
      }

      if (hasRecoverySignal) {
        await new Promise((r) => setTimeout(r, 400));
        const { data: s2 } = await supabase.auth.getSession();
        if (cancelled) return;
        if (s2.session?.user) {
          setChecking(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 900));
        const { data: s3 } = await supabase.auth.getSession();
        if (cancelled) return;
        if (s3.session?.user) {
          setChecking(false);
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        redirectToLogin();
      } else {
        setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [safeTo, required]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    const pw = validatePasswordStrength(newPassword);
    if (!pw.ok) {
      setErrorMessage(pw.message ?? "Mật khẩu không đủ mạnh.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Có lỗi xảy ra.");
        return;
      }

      window.location.href = safeTo;
    } catch {
      setErrorMessage("Không thể kết nối.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a1628] text-white">
        <p className="text-gray-400">Đang kiểm tra...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a1628] px-6 py-12 text-white">
      <header className="mx-auto mb-8 flex max-w-xl items-center justify-between">
        <NavLogoWithBanner />
        <Link
          href="/"
          className="rounded-full border border-[#D4AF37]/50 bg-[#282c36] px-4 py-2 text-sm font-semibold text-[#D4AF37] transition-colors hover:bg-[#D4AF37]/10"
        >
          Trang chủ
        </Link>
      </header>

      <div className="mx-auto max-w-xl rounded-2xl border border-[#D4AF37]/30 bg-[#111c31]/90 p-8 shadow-[0_0_35px_rgba(212,175,55,0.15)]">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Đổi mật khẩu
        </h1>
        {required && (
          <p className="mt-3 text-sm text-amber-200/90">
            Đây là lần đăng nhập đầu tiên. Vui lòng đặt mật khẩu mới để bảo mật tài khoản trước khi truy cập dashboard.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Mật khẩu mới <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={10}
              placeholder="Tối thiểu 10 ký tự, có hoa/thường/số"
              className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white placeholder-gray-500"
            />
            <p className="mt-1 text-xs text-gray-500">Ít nhất 10 ký tự: chữ hoa, chữ thường và số.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              Xác nhận mật khẩu <span className="text-red-400">*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={10}
              placeholder="Nhập lại mật khẩu mới"
              className="w-full rounded-xl border border-white/15 bg-[#0a1628] px-4 py-2.5 text-white placeholder-gray-500"
            />
          </div>

          {errorMessage && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-6 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(212,175,55,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Đang xử lý..." : "Đổi mật khẩu và tiếp tục"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0a1628] text-gray-300">
          Đang tải...
        </main>
      }
    >
      <ChangePasswordContent />
    </Suspense>
  );
}
