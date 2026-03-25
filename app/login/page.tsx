"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import NavLogoWithBanner from "../../components/NavLogoWithBanner";
import { completeLoginRedirect } from "../../lib/complete-login-redirect";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";

const supabase = getSupabaseBrowserClient();

type LoginMode = "password" | "email";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const safeRedirectTo = useMemo(() => {
    const to = searchParams.get("to");
    if (to && to.startsWith("/") && !to.startsWith("//")) return to;
    return "/";
  }, [searchParams]);

  const [loginMode, setLoginMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [otpSendBusy, setOtpSendBusy] = useState(false);
  const [otpVerifyBusy, setOtpVerifyBusy] = useState(false);
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

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

  async function handleSendOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOtpError(null);
    setOtpInfo(null);
    const trimmed = otpEmail.trim();
    if (!trimmed) {
      setOtpError("Vui lòng nhập email.");
      return;
    }
    setOtpSendBusy(true);
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("to", safeRedirectTo);

      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: callbackUrl.toString(),
        },
      });
      if (error) {
        setOtpError(error.message);
        return;
      }
      setOtpStep("verify");
      setOtpInfo(
        "Đã gửi email. Mở link trong thư hoặc nhập mã 6 số (nếu Supabase bật OTP). Kiểm tra cả thư mục spam."
      );
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Không gửi được email.");
    } finally {
      setOtpSendBusy(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOtpError(null);
    const trimmedEmail = otpEmail.trim();
    const code = otpCode.replace(/\D/g, "");
    if (!trimmedEmail || code.length < 6) {
      setOtpError("Nhập email và mã 6 chữ số từ email.");
      return;
    }
    setOtpVerifyBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: code,
        type: "email",
      });
      if (error) {
        setOtpError(error.message);
        return;
      }
      await completeLoginRedirect(supabase, router, { redirectTo: safeRedirectTo });
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Xác nhận thất bại.");
    } finally {
      setOtpVerifyBusy(false);
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
        <p className="mt-3 text-sm text-gray-300">
          Truy cập hệ thống học tập bảo mật của KM Global Academy.
        </p>

        <div className="mt-6 flex rounded-xl border border-white/10 bg-[#0b1323]/80 p-1">
          <button
            type="button"
            onClick={() => {
              setLoginMode("password");
              setOtpError(null);
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              loginMode === "password"
                ? "bg-[#D4AF37]/20 text-[#D4AF37]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Mật khẩu
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("email");
              setErrorMessage("");
              if (otpEmail === "" && email.trim()) setOtpEmail(email.trim());
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
              loginMode === "email"
                ? "bg-[#D4AF37]/20 text-[#D4AF37]"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Email (mã / link)
          </button>
        </div>

        {loginMode === "password" ? (
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
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
        ) : (
          <div className="mt-6 space-y-6">
            {otpStep === "request" ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-gray-400">
                  Dành cho tài khoản đã đăng ký. Bạn sẽ nhận link đăng nhập hoặc mã 6 số (tùy cấu hình Supabase).
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/90">Email</label>
                  <input
                    type="email"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D4AF37]"
                    placeholder="name@company.com"
                    required
                    autoComplete="email"
                  />
                </div>
                {otpError && (
                  <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {otpError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={otpSendBusy}
                  className="w-full rounded-full border border-emerald-500/60 bg-emerald-500/10 px-6 py-3 text-sm font-bold text-emerald-100 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {otpSendBusy ? "Đang gửi..." : "Gửi mã / link đăng nhập"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {otpInfo && (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100">
                    {otpInfo}
                  </p>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/90">Mã 6 số (nếu có trong email)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-center font-mono text-lg tracking-widest text-white outline-none transition focus:border-[#D4AF37]"
                    placeholder="000000"
                    maxLength={6}
                    autoComplete="one-time-code"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Nếu email chỉ có nút/link, nhấp link — không cần nhập mã. Hoặc nhập mã rồi bấm Xác nhận.
                </p>
                {otpError && (
                  <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {otpError}
                  </p>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep("request");
                      setOtpCode("");
                      setOtpInfo(null);
                      setOtpError(null);
                    }}
                    className="rounded-full border border-white/20 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5"
                  >
                    ← Gửi lại email
                  </button>
                  <button
                    type="submit"
                    disabled={otpVerifyBusy}
                    className="flex-1 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-6 py-2.5 text-sm font-bold text-black disabled:opacity-60"
                  >
                    {otpVerifyBusy ? "Đang xác nhận..." : "Xác nhận mã"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

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
