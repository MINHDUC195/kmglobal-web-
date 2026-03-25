"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import NavLogoWithBanner from "../../../components/NavLogoWithBanner";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";

/**
 * Trang thông báo kiểm tra email - sau khi đăng ký cần xác nhận
 */
function CheckEmailContent() {
  const RATE_LIMIT_SECONDS = 900;
  const RESEND_LIMIT_KEY_PREFIX = "kmglobal_resend_limit_until_";
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get("email") || "";
  const isReady = searchParams.get("ready") === "1";
  const [emailInput, setEmailInput] = useState(emailFromUrl);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<"success" | "error" | null>(null);
  const [resendErrorText, setResendErrorText] = useState("");
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const email = emailFromUrl || emailInput.trim();
  const resendLimitKey = `${RESEND_LIMIT_KEY_PREFIX}${email.toLowerCase()}`;

  useEffect(() => {
    if (emailFromUrl) setEmailInput(emailFromUrl);
  }, [emailFromUrl]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (typeof window === "undefined" || !email) return;
    const raw = window.localStorage.getItem(resendLimitKey);
    if (!raw) return;
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= Date.now()) {
      window.localStorage.removeItem(resendLimitKey);
      return;
    }
    const seconds = Math.ceil((until - Date.now()) / 1000);
    setCooldownSeconds((prev) => (prev > 0 ? prev : seconds));
    setResendMessage("error");
    setResendErrorText("Hệ thống gửi mail đang bị giới hạn tạm thời từ Supabase. Vui lòng thử lại sau.");
  }, [email, resendLimitKey]);

  async function handleResend() {
    if (!email || resending || cooldownSeconds > 0) return;
    setResending(true);
    setResendMessage(null);
    setResendErrorText("");
    try {
      const supabase = getSupabaseBrowserClient();
      const emailRedirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/auth/confirm` : undefined;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo },
      });
      if (error) {
        if ((error as { status?: number }).status === 429) {
          setCooldownSeconds(RATE_LIMIT_SECONDS);
          if (typeof window !== "undefined" && email) {
            const until = Date.now() + RATE_LIMIT_SECONDS * 1000;
            window.localStorage.setItem(resendLimitKey, String(until));
          }
          setResendErrorText("Supabase đang giới hạn gửi email. Vui lòng chờ khoảng 15 phút rồi thử lại.");
        } else {
          setResendErrorText("Không thể gửi lại. Vui lòng thử sau.");
        }
        setResendMessage("error");
        return;
      }
      setResendMessage("success");
    } catch {
      setResendErrorText("Không thể gửi lại. Vui lòng thử sau.");
      setResendMessage("error");
    } finally {
      setResending(false);
    }
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
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#D4AF37]/20">
          <svg
            className="h-8 w-8 text-[#D4AF37]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          {isReady ? "Đăng ký thành công" : "Vui lòng kiểm tra và xác nhận email đăng ký"}
        </h1>
        <p className="mt-4 text-gray-300">
          {isReady
            ? "Tài khoản của bạn đã sẵn sàng. Bạn có thể đăng nhập ngay."
            : "Chúng tôi đã gửi link xác nhận tới địa chỉ email bạn đăng ký. Vui lòng mở email và nhấp vào link để kích hoạt tài khoản."}
        </p>
        {email && (
          <p className="mt-2 rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-[#D4AF37]/90">
            {email}
          </p>
        )}
        {!isReady && (
          <p className="mt-4 text-sm text-gray-400">
            Không thấy email? Kiểm tra hộp thư rác hoặc nhấn nút bên dưới để gửi lại.
          </p>
        )}

        {!emailFromUrl && (
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Nhập email đã đăng ký"
            className="mt-4 w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]"
          />
        )}

        {!isReady &&
          (email ? (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || cooldownSeconds > 0}
              className="mt-4 rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-50"
            >
              {resending
                ? "Đang gửi..."
                : cooldownSeconds > 0
                  ? `Thử lại sau ${Math.ceil(cooldownSeconds / 60)} phút`
                  : "Gửi lại email xác nhận"}
            </button>
          ) : (
            <p className="mt-4 text-sm text-amber-400/90">
              Nhập email phía trên để gửi lại link xác nhận.
            </p>
          ))}

        {resendMessage === "success" && (
          <p className="mt-4 text-sm text-emerald-400">Đã gửi lại email xác nhận.</p>
        )}
        {resendMessage === "error" && (
          <p className="mt-4 text-sm text-red-400">{resendErrorText || "Không thể gửi lại. Vui lòng thử sau."}</p>
        )}

        <Link
          href="/login"
          className="mt-8 inline-block rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
        >
          Đăng nhập
        </Link>
      </div>
    </main>
  );
}

export default function CheckEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0a1628] text-gray-400">
          Đang tải...
        </main>
      }
    >
      <CheckEmailContent />
    </Suspense>
  );
}
