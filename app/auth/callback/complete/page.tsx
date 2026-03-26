"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import NavLogoWithBanner from "../../../../components/NavLogoWithBanner";
import { applyPendingOAuthRegisterConsent } from "../../../../lib/apply-oauth-register-consent";
import { completeLoginRedirect } from "../../../../lib/complete-login-redirect";
import { getSupabaseBrowserClient } from "../../../../lib/supabase-browser";

/**
 * Sau khi route handler đã exchange PKCE và set cookie session.
 */
function AuthCallbackCompleteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("to");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Đang hoàn tất đăng nhập...");
  const [phase, setPhase] = useState<
    "preparing" | "checking-consent" | "resolving-redirect" | "done" | "failed"
  >("preparing");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function run() {
      try {
        setPhase("checking-consent");
        setMessage("Đang xác nhận thông tin đăng ký...");
        await applyPendingOAuthRegisterConsent();
        setPhase("resolving-redirect");
        setMessage("Đang xác định trang đích...");
        await completeLoginRedirect(supabase, router, { redirectTo });
        setPhase("done");
        setStatus("success");
        setMessage("Đang chuyển hướng...");
      } catch (err) {
        console.error("[auth/callback/complete]", err);
        setPhase("failed");
        setStatus("error");
        setMessage("Có lỗi xảy ra. Vui lòng thử lại.");
      }
    }

    void run();
  }, [router, redirectTo]);

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

      <div className="mx-auto max-w-xl rounded-2xl border border-[#D4AF37]/30 bg-[#111c31]/90 p-6 shadow-[0_0_35px_rgba(212,175,55,0.15)] sm:p-8">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          {status === "loading" && "Đang xử lý..."}
          {status === "success" && "Đăng nhập thành công"}
          {status === "error" && "Không thể đăng nhập"}
        </h1>
        <p className="mt-4 text-gray-300">{message}</p>
        {status === "loading" && (
          <ol className="mt-4 space-y-2 text-sm text-gray-300">
            <li className={phase !== "preparing" ? "text-emerald-300" : ""}>
              1. Chuẩn bị phiên đăng nhập
            </li>
            <li
              className={
                phase === "checking-consent" || phase === "resolving-redirect" || phase === "done"
                  ? "text-emerald-300"
                  : ""
              }
            >
              2. Xác nhận điều kiện tài khoản
            </li>
            <li
              className={phase === "resolving-redirect" || phase === "done" ? "text-emerald-300" : ""}
            >
              3. Chuyển đến trang phù hợp
            </li>
          </ol>
        )}

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

export default function AuthCallbackCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0a1628] px-6 py-12 text-white">
          <p className="text-gray-300">Đang tải...</p>
        </main>
      }
    >
      <AuthCallbackCompleteInner />
    </Suspense>
  );
}
