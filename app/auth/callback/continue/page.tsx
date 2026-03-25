"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import NavLogoWithBanner from "../../../../components/NavLogoWithBanner";
import { applyPendingOAuthRegisterConsent } from "../../../../lib/apply-oauth-register-consent";
import { completeLoginRedirect } from "../../../../lib/complete-login-redirect";
import { getSupabaseBrowserClient } from "../../../../lib/supabase-browser";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "email",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
];

function parseOtpType(raw: string | null): EmailOtpType | null {
  if (!raw) return null;
  return OTP_TYPES.includes(raw as EmailOtpType) ? (raw as EmailOtpType) : null;
}

/**
 * Luồng không có ?code= (đã xử lý ở route.ts): token_hash, implicit hash, hoặc session sẵn có.
 * Truy cập nội bộ qua rewrite từ GET /auth/callback.
 */
export default function AuthCallbackContinuePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập...");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function run() {
      try {
        if (typeof window === "undefined") return;

        const url = new URL(window.location.href);
        const params = url.searchParams;
        const redirectTo = params.get("to");
        const tokenHash = params.get("token_hash");
        const otpType = parseOtpType(params.get("type"));

        const authError = params.get("error");
        const authErrorDesc = params.get("error_description");
        if (authError) {
          setStatus("error");
          setMessage(
            authErrorDesc
              ? decodeURIComponent(authErrorDesc.replace(/\+/g, " "))
              : "Liên kết đăng nhập không hợp lệ hoặc đã hết hạn."
          );
          return;
        }

        if (tokenHash && otpType) {
          const { error: otpErr } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          });
          if (otpErr) {
            console.warn("[auth/callback/continue] verifyOtp:", otpErr.message);
            setStatus("error");
            setMessage("Liên kết đăng nhập không hợp lệ hoặc đã hết hạn.");
            return;
          }
          window.history.replaceState(null, "", url.pathname + (redirectTo ? `?to=${encodeURIComponent(redirectTo)}` : ""));
          await applyPendingOAuthRegisterConsent();
          await completeLoginRedirect(supabase, router, { redirectTo });
          setStatus("success");
          setMessage("Đang chuyển hướng...");
          return;
        }

        await supabase.auth.getSession();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          window.history.replaceState(null, "", window.location.pathname);
          await applyPendingOAuthRegisterConsent();
          await completeLoginRedirect(supabase, router, { redirectTo });
          setStatus("success");
          setMessage("Đang chuyển hướng...");
          return;
        }

        const hasHash = window.location.hash?.length > 0;
        if (hasHash) {
          await new Promise((r) => setTimeout(r, 800));
          const {
            data: { session: retrySession },
          } = await supabase.auth.getSession();
          if (retrySession?.user) {
            window.history.replaceState(null, "", window.location.pathname);
            await applyPendingOAuthRegisterConsent();
            await completeLoginRedirect(supabase, router, { redirectTo });
            setStatus("success");
            setMessage("Đang chuyển hướng...");
            return;
          }
        }

        setStatus("error");
        setMessage(
          hasHash || tokenHash
            ? "Không thể hoàn tất đăng nhập. Liên kết có thể đã hết hạn."
            : "Thiếu thông tin xác thực. Hãy mở link trong email đăng nhập."
        );
      } catch (err) {
        console.error("[auth/callback/continue]", err);
        setStatus("error");
        setMessage("Có lỗi xảy ra. Vui lòng thử lại.");
      }
    }

    void run();
  }, [router]);

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
          {status === "loading" && "Đang xử lý..."}
          {status === "success" && "Đăng nhập thành công"}
          {status === "error" && "Không thể đăng nhập"}
        </h1>
        <p className="mt-4 text-gray-300">{message}</p>

        {status === "error" && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
            >
              Quay lại đăng nhập
            </Link>
          </div>
        )}

        {status === "loading" && (
          <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full animate-pulse rounded-full bg-[#D4AF37]/50" style={{ width: "40%" }} />
          </div>
        )}
      </div>
    </main>
  );
}
