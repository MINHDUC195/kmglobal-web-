"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import NavLogoWithBanner from "../../../components/NavLogoWithBanner";
import PolicyModal from "../../../components/PolicyModal";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";

function AgreeTermsContent() {
  const searchParams = useSearchParams();
  const to = searchParams.get("to") || "/";
  const safeTo = to.startsWith("/") && !to.startsWith("//") ? to : "/";

  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [policyModal, setPolicyModal] = useState<"terms" | "privacy" | null>(null);

  useEffect(() => {
    getSupabaseBrowserClient().auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      const { user } = data;
      if (!user) {
        const returnTo = `/auth/agree-terms?to=${encodeURIComponent(safeTo)}`;
        window.location.href = `/login?reason=not-authenticated&to=${encodeURIComponent(returnTo)}`;
      }
    });
  }, [safeTo]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    if (!agreed) {
      setErrorMessage("Vui lòng tích chọn để xác nhận đồng ý.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/agree-terms", { method: "POST" });
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
          Đồng ý Điều khoản và Chính sách bảo mật
        </h1>
        <p className="mt-3 text-sm text-gray-300">
          Để tiếp tục sử dụng hệ thống, vui lòng xác nhận bạn đã đọc và đồng ý với các điều khoản pháp lý sau.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#0b1323]/70 p-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
            />
            <span>
              Tôi đã đọc và đồng ý với{" "}
              <button
                type="button"
                onClick={() => setPolicyModal("terms")}
                className="font-semibold text-[#D4AF37] underline underline-offset-2 hover:text-[#E7C768]"
              >
                Điều khoản sử dụng
              </button>{" "}
              và{" "}
              <button
                type="button"
                onClick={() => setPolicyModal("privacy")}
                className="font-semibold text-[#D4AF37] underline underline-offset-2 hover:text-[#E7C768]"
              >
                Chính sách bảo mật
              </button>{" "}
              của KM Global Academy.
            </span>
          </label>

          {errorMessage && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={!agreed || isSubmitting}
            className="w-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-6 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(212,175,55,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Đang xử lý..." : "Xác nhận và tiếp tục"}
          </button>
        </form>

        <PolicyModal
          type={policyModal ?? "terms"}
          isOpen={policyModal !== null}
          onClose={() => setPolicyModal(null)}
          onSwitch={(t) => setPolicyModal(t)}
        />
      </div>
    </main>
  );
}

export default function AgreeTermsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0a1628] text-gray-300">
          Đang tải...
        </main>
      }
    >
      <AgreeTermsContent />
    </Suspense>
  );
}
