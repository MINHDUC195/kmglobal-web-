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

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedThirdPartyData, setAcceptedThirdPartyData] = useState(false);
  const [providerHint, setProviderHint] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [policyModal, setPolicyModal] = useState<"terms" | "privacy" | null>(null);

  useEffect(() => {
    getSupabaseBrowserClient().auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      const { user } = data;
      if (!user) {
        const returnTo = `/auth/agree-terms?to=${encodeURIComponent(safeTo)}`;
        window.location.href = `/login?reason=not-authenticated&to=${encodeURIComponent(returnTo)}`;
        return;
      }
      const provider = user?.app_metadata?.provider;
      if (provider === "google") setProviderHint("Google");
      else if (provider === "apple") setProviderHint("Apple");
      else if (provider === "azure") setProviderHint("Microsoft");
    });
  }, [safeTo]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    if (!acceptedTerms || !acceptedPrivacy || !acceptedThirdPartyData) {
      setErrorMessage("Vui lòng tích đủ 3 mục xác nhận để tiếp tục.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/agree-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedTerms,
          acceptedPrivacy,
          acceptedThirdPartyData,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Có lỗi xảy ra.");
        return;
      }

      const incomplete = Boolean((data as { profileIncomplete?: boolean }).profileIncomplete);
      if (incomplete) {
        window.location.href = `/student/profile?required=1&to=${encodeURIComponent(safeTo)}`;
      } else {
        window.location.href = safeTo;
      }
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
          Xác nhận trước khi tiếp tục
        </h1>
        <p className="mt-3 text-sm text-gray-300">
          Để tiếp tục sử dụng hệ thống, vui lòng xác nhận đầy đủ Điều khoản, Chính sách bảo mật và đồng ý xử lý dữ liệu.
        </p>
        {providerHint && (
          <p className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            Bạn đang đăng nhập bằng tài khoản bên thứ ba: <strong>{providerHint}</strong>.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#0b1323]/70 p-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
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
              của KM Global Academy.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#0b1323]/70 p-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(e) => setAcceptedPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
            />
            <span>
              Tôi xác nhận đã đọc kỹ nội dung về mục đích xử lý, thời gian lưu trữ, quyền của chủ thể dữ liệu trong{" "}
              <button
                type="button"
                onClick={() => setPolicyModal("privacy")}
                className="font-semibold text-[#D4AF37] underline underline-offset-2 hover:text-[#E7C768]"
              >
                Chính sách bảo mật
              </button>
              .
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#0b1323]/70 p-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={acceptedThirdPartyData}
              onChange={(e) => setAcceptedThirdPartyData(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
            />
            <span>
              Tôi đồng ý để KM Global Academy nhận và xử lý các thông tin cần thiết từ tài khoản bên thứ ba (Google / Apple / Microsoft), bao gồm email và dữ liệu liên hệ cơ bản phục vụ học tập, đăng ký khóa học và chăm sóc học viên; phù hợp quy định pháp luật Việt Nam.
            </span>
          </label>

          {errorMessage && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={!acceptedTerms || !acceptedPrivacy || !acceptedThirdPartyData || isSubmitting}
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
