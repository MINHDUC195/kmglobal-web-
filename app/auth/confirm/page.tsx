"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavLogoWithBanner from "../../../components/NavLogoWithBanner";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";

/**
 * Trang xác nhận email - Supabase redirect về đây sau khi user click link trong email
 * URL sẽ chứa hash (#access_token=...) - Supabase client tự xử lý và tạo session
 */
export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Đang xác nhận email...");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const hasHash = typeof window !== "undefined" && window.location.hash?.length > 0;

    async function handleConfirm() {
      try {
        await supabase.auth.getSession();
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setStatus("success");
          setMessage("Email của bạn đã được xác nhận thành công.");
          window.history.replaceState(null, "", window.location.pathname);
          setTimeout(() => router.push("/login"), 2000);
          return;
        }

        if (hasHash) {
          await new Promise((r) => setTimeout(r, 800));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession?.user) {
            setStatus("success");
            setMessage("Email của bạn đã được xác nhận thành công.");
            window.history.replaceState(null, "", window.location.pathname);
            setTimeout(() => router.push("/login"), 2000);
            return;
          }
        }

        setStatus("error");
        setMessage(
          hasHash
            ? "Liên kết xác nhận không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập hoặc gửi lại email xác nhận."
            : "Vui lòng nhấp vào link xác nhận trong email của bạn."
        );
      } catch {
        setStatus("error");
        setMessage("Có lỗi xảy ra khi xác nhận. Vui lòng thử lại.");
      }
    }

    void handleConfirm();
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
          {status === "loading" && "Đang xác nhận..."}
          {status === "success" && "Xác nhận thành công"}
          {status === "error" && "Xác nhận thất bại"}
        </h1>
        <p className="mt-4 text-gray-300">{message}</p>

        {status === "success" && (
          <p className="mt-2 text-sm text-gray-400">
            Bạn sẽ được chuyển tới trang đăng nhập trong giây lát...
          </p>
        )}

        {status === "error" && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
            >
              Đăng nhập
            </Link>
            <Link
              href="/auth/check-email"
              className="rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              Gửi lại email xác nhận
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
