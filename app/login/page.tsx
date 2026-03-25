"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Provider } from "@supabase/supabase-js";
import NavLogoWithBanner from "../../components/NavLogoWithBanner";
import { completeLoginRedirect } from "../../lib/complete-login-redirect";
import { formatOAuthClientError } from "../../lib/oauth-error-message";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

const supabase = getSupabaseBrowserClient();

const OAUTH_PROVIDERS: { provider: Provider; label: string }[] = [
  { provider: "google", label: "Google" },
];

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const safeRedirectTo = useMemo(() => {
    const to = searchParams.get("to");
    if (to && to.startsWith("/") && !to.startsWith("//")) return to;
    return "/";
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<Provider | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);
  const [forgotErr, setForgotErr] = useState<string | null>(null);

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (!reason) return;

    if (reason === "session-revoked") {
      setErrorMessage("Phiên đăng nhập cũ đã bị thu hồi. Vui lòng đăng nhập lại.");
      return;
    }
    if (reason === "not-authenticated") {
      setErrorMessage("Bạn cần đăng nhập để tiếp tục.");
      return;
    }
    if (reason === "config-missing") {
      setErrorMessage("Hệ thống chưa cấu hình Supabase đầy đủ. Vui lòng liên hệ quản trị.");
    }
  }, [searchParams]);

  async function handleForgotSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setForgotErr(null);
    setForgotMsg(null);
    const trimmed = forgotEmail.trim();
    if (!trimmed) {
      setForgotErr("Vui lòng nhập email.");
      return;
    }
    setForgotBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth/change-password?to=${encodeURIComponent("/login")}`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
      if (error) {
        setForgotErr(error.message);
        return;
      }
      setForgotMsg(
        "Nếu email tồn tại trong hệ thống, bạn sẽ nhận link đặt lại mật khẩu. Kiểm tra cả hộp thư spam."
      );
    } catch (err) {
      setForgotErr(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error || !data.user) {
        const errMsg = error?.message || "Đăng nhập thất bại.";
        const isNetwork = /fetch|network|failed|ECONNREFUSED|timeout/i.test(errMsg);
        const isEmailNotConfirmed = /email not confirmed/i.test(errMsg);
        if (isEmailNotConfirmed) {
          setErrorMessage(
            "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư và nhấp vào link xác nhận trong email đăng ký."
          );
          return;
        }
        setErrorMessage(isNetwork ? "Không thể kết nối. Kiểm tra mạng và cấu hình Supabase." : errMsg);
        return;
      }

      await completeLoginRedirect(supabase, router, { redirectTo: safeRedirectTo });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Có lỗi hệ thống xảy ra.";
      const isNetwork = /fetch|network|failed|ECONNREFUSED|timeout/i.test(msg);
      const isEmailNotConfirmed = /email not confirmed/i.test(msg);
      if (isEmailNotConfirmed) {
        setErrorMessage(
          "Email chưa được xác nhận. Vui lòng kiểm tra hộp thư và nhấp vào link xác nhận trong email đăng ký."
        );
      } else {
        setErrorMessage(isNetwork ? "Không thể kết nối. Kiểm tra mạng và cấu hình Supabase." : msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOAuth(provider: Provider) {
    setErrorMessage("");
    setOauthBusy(provider);
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("to", safeRedirectTo);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl.toString() },
      });
      if (error) {
        setErrorMessage(formatOAuthClientError(error.message));
        return;
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Không thể đăng nhập với bên thứ ba.";
      setErrorMessage(formatOAuthClientError(raw));
    } finally {
      setOauthBusy(null);
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
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-bold text-[#D4AF37]">
          Đăng nhập
        </h1>
        <div className="mt-6 space-y-2">
          {OAUTH_PROVIDERS.map((p) => (
            <button
              key={p.provider}
              type="button"
              onClick={() => void handleOAuth(p.provider)}
              disabled={Boolean(oauthBusy)}
              className="w-full rounded-full border border-white/20 bg-[#0b1323]/70 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {oauthBusy === p.provider ? "Đang chuyển hướng..." : `Tiếp tục với ${p.label}`}
            </button>
          ))}
        </div>

        <div className="my-5 flex items-center gap-3 text-xs text-gray-500">
          <span className="h-px flex-1 bg-white/10" />
          Hoặc đăng nhập bằng email
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D4AF37]"
                placeholder="name@company.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-white/90">Mật khẩu</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email.trim());
                    setForgotErr(null);
                    setForgotMsg(null);
                    setForgotOpen(true);
                  }}
                  className="text-sm text-[#D4AF37] hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D4AF37]"
                required
                autoComplete="current-password"
              />
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                <p>{errorMessage}</p>
                {(/email chưa được xác nhận/i.test(errorMessage) || /email not confirmed/i.test(errorMessage)) &&
                  email.trim() && (
                    <Link
                      href={`/auth/check-email?email=${encodeURIComponent(email.trim())}`}
                      className="mt-2 inline-block font-medium text-[#D4AF37] underline hover:no-underline"
                    >
                      Gửi lại email xác nhận
                    </Link>
                  )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-6 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(212,175,55,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
        </form>

        <p className="mt-5 text-sm text-gray-300">
          Chưa có tài khoản?{" "}
          <Link href="/register" className="font-semibold text-[#D4AF37] hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-title"
            className="w-full max-w-md rounded-2xl border border-[#D4AF37]/30 bg-[#111c31] p-6 shadow-[0_0_35px_rgba(212,175,55,0.15)]"
          >
            <h2 id="forgot-title" className="text-lg font-semibold text-[#D4AF37]">
              Đặt lại mật khẩu
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              Nhập email đã đăng ký. Bạn sẽ nhận link để đặt mật khẩu mới (kiểm tra cả thư mục spam).
            </p>
            <form onSubmit={handleForgotSubmit} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-gray-300">Email</label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none focus:border-[#D4AF37]"
                  placeholder="name@company.com"
                />
              </div>
              {forgotErr && (
                <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {forgotErr}
                </p>
              )}
              {forgotMsg && (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
                  {forgotMsg}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={forgotBusy}
                  className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e4c657] disabled:opacity-50"
                >
                  {forgotBusy ? "Đang gửi..." : "Gửi link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0a1628] px-6 py-12 text-white">
          <p className="text-gray-400">Đang tải...</p>
        </main>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
