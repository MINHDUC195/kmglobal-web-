"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Provider } from "@supabase/supabase-js";
import NavLogoWithBanner from "../../components/NavLogoWithBanner";
import PolicyModal from "../../components/PolicyModal";
import { formatOAuthClientError } from "../../lib/oauth-error-message";
import { getSupabaseBrowserClient } from "../../lib/supabase-browser";
import { validatePasswordStrength } from "../../lib/password-policy";

const supabase = getSupabaseBrowserClient();

const REGISTER_DRAFT_KEY = "kmglobal_register_draft";

const BLOCKED_KEYWORDS = ["iso", "iatf", "certification", "advisor", "consulting"];
const BLOCKED_MESSAGE =
  "Rất tiếc, hệ thống không hỗ trợ đăng ký cho các tổ chức tư vấn/chứng nhận quản lý chất lượng.";
const OAUTH_PROVIDERS: { provider: Provider; label: string }[] = [
  { provider: "google", label: "Google (Gmail)" },
];

function isCompetitorEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return true;

  const domain = normalized.split("@")[1] || "";
  const compactDomain = domain.replace(/[^a-z0-9]/g, "");
  const compactEmail = normalized.replace(/[^a-z0-9@]/g, "");
  const target = `${normalized} ${domain} ${compactDomain} ${compactEmail}`;
  return BLOCKED_KEYWORDS.some((keyword) => target.includes(keyword));
}

interface RegisterDraft {
  fullName: string;
  email: string;
  address: string;
  company: string;
  phone: string;
  gender: string;
}

function loadDraft(): RegisterDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(REGISTER_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as RegisterDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: RegisterDraft) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(REGISTER_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export default function RegisterPage() {
  const router = useRouter();
  const [securityRequired, setSecurityRequired] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female" | "other">("");
  const [securitySigned, setSecuritySigned] = useState(false);
  const [thirdPartyConsent, setThirdPartyConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<Provider | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [policyModal, setPolicyModal] = useState<"terms" | "privacy" | null>(null);

  const canSubmit = useMemo(
    () =>
      fullName.trim().length > 1 &&
      email.trim().length > 5 &&
      validatePasswordStrength(password).ok &&
      securitySigned &&
      thirdPartyConsent,
    [fullName, email, password, securitySigned, thirdPartyConsent]
  );

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSecurityRequired(params.get("security") === "required");
  }, []);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setFullName(draft.fullName ?? "");
      setEmail(draft.email ?? "");
      setAddress(draft.address ?? "");
      setCompany(draft.company ?? "");
      setPhone(draft.phone ?? "");
      setGender((draft.gender as "" | "male" | "female" | "other") ?? "");
    }
  }, []);

  const persistDraft = useCallback(() => {
    saveDraft({
      fullName,
      email,
      address,
      company,
      phone,
      gender,
    });
  }, [fullName, email, address, company, phone, gender]);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(persistDraft, 300);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [persistDraft]);

  async function handleRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (isCompetitorEmail(email)) {
      setErrorMessage(BLOCKED_MESSAGE);
      return;
    }

    if (!securitySigned || !thirdPartyConsent) {
      setErrorMessage("Bạn cần tích đủ các xác nhận pháp lý để tiếp tục.");
      return;
    }

    const pwCheck = validatePasswordStrength(password);
    if (!pwCheck.ok) {
      setErrorMessage(pwCheck.message ?? "Mật khẩu không đủ mạnh.");
      return;
    }

    try {
      setIsSubmitting(true);

      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const emailRedirectTo = baseUrl ? `${baseUrl}/auth/confirm` : undefined;
      const now = new Date().toISOString();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: fullName.trim(),
            address: address.trim() || undefined,
            company: company.trim() || undefined,
            phone: phone.trim() || undefined,
            gender: gender || undefined,
            security_signed: true,
            security_agreed_at: now,
            data_sharing_consent_at: now,
          },
        },
      });

      if (error) {
        const isNetwork = /fetch|network|failed|ECONNREFUSED|timeout/i.test(error.message);
        setErrorMessage(isNetwork ? "Không thể kết nối. Kiểm tra mạng và cấu hình Supabase." : error.message);
        return;
      }

      clearDraft();
      const needsConfirmation = data.user && !data.session;
      setSuccessMessage("Đăng ký thành công! Đang chuyển hướng...");
      const params = new URLSearchParams({ email: email.trim() });
      if (!needsConfirmation) params.set("ready", "1");
      setTimeout(() => router.push(`/auth/check-email?${params.toString()}`), 800);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Có lỗi hệ thống xảy ra.";
      const isNetwork = /fetch|network|failed|ECONNREFUSED|timeout/i.test(msg);
      setErrorMessage(isNetwork ? "Không thể kết nối. Kiểm tra mạng và cấu hình Supabase." : msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOAuth(provider: Provider) {
    setErrorMessage("");
    setSuccessMessage("");
    if (!securitySigned || !thirdPartyConsent) {
      setErrorMessage(
        "Vui lòng tích đủ hai mục phía trên (Điều khoản & Chính sách bảo mật, và đồng ý xử lý thông tin khi đăng ký / đăng nhập qua bên thứ ba) trước khi tiếp tục."
      );
      return;
    }
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("oauth_register_consent_pending", "1");
      }
    } catch {
      /* private mode */
    }
    setOauthBusy(provider);
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("to", "/student");
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl.toString() },
      });
      if (error) {
        setErrorMessage(formatOAuthClientError(error.message));
        return;
      }
    } catch (error) {
      const raw =
        error instanceof Error ? error.message : "Không thể đăng ký bằng tài khoản bên thứ ba.";
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
          Đăng ký tài khoản
        </h1>
        <p className="mt-3 text-sm text-gray-300">
          Đăng ký bằng email hoặc qua Google / Apple / Microsoft. Với tài khoản bên thứ ba, bạn xác nhận đồng ý xử lý dữ liệu ngay tại bước đăng ký (mục thứ hai bên dưới).
        </p>
        {securityRequired && (
          <div className="mt-3 rounded-lg border border-amber-300/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            <p className="font-medium">Bạn cần đồng ý chính sách pháp lý để sử dụng hệ thống</p>
            <p className="mt-1 text-amber-100/90">
              Vui lòng tích đủ các ô xác nhận phía dưới trước khi đăng ký.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#0b1323]/70 p-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={securitySigned}
              onChange={(e) => setSecuritySigned(e.target.checked)}
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
          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#0b1323]/70 p-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={thirdPartyConsent}
              onChange={(e) => setThirdPartyConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
            />
            <span>
              Tôi đồng ý để KM Global Academy xử lý thông tin liên hệ (email, số điện thoại, họ tên và dữ liệu cơ bản)
              bao gồm thông tin nhận từ Google / Apple / Microsoft khi đăng ký hoặc đăng nhập qua bên thứ ba, theo{" "}
              <button
                type="button"
                onClick={() => setPolicyModal("privacy")}
                className="font-semibold text-[#D4AF37] underline underline-offset-2 hover:text-[#E7C768]"
              >
                Chính sách bảo mật
              </button>{" "}
              và quy định pháp luật Việt Nam.
            </span>
          </label>
        </div>

        <div className="mt-6 space-y-2">
          {OAUTH_PROVIDERS.map((p) => (
            <button
              key={p.provider}
              type="button"
              onClick={() => void handleOAuth(p.provider)}
              disabled={Boolean(oauthBusy) || !securitySigned || !thirdPartyConsent}
              className="w-full rounded-full border border-white/20 bg-[#0b1323]/70 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {oauthBusy === p.provider ? "Đang chuyển hướng..." : `Đăng ký với ${p.label}`}
            </button>
          ))}
        </div>
        <div className="my-5 flex items-center gap-3 text-xs text-gray-500">
          <span className="h-px flex-1 bg-white/10" />
          Hoặc tạo tài khoản bằng email
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleRegister} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Họ và tên</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D4AF37]"
              placeholder="Nhập họ tên của bạn"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D4AF37]"
              placeholder="name@company.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Địa chỉ</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D4AF37]"
              placeholder="Địa chỉ (tùy chọn)"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Công ty / Trường học</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D4AF37]"
              placeholder="Tên công ty hoặc đơn vị (tùy chọn)"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Số điện thoại</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D4AF37]"
              placeholder="Số điện thoại (tùy chọn)"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Giới tính</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as "" | "male" | "female" | "other")}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D4AF37]"
            >
              <option value="">Chọn (tùy chọn)</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition focus:border-[#D4AF37]"
              placeholder="Tối thiểu 10 ký tự"
              minLength={10}
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              Ít nhất 10 ký tự, gồm chữ hoa, chữ thường và số.
            </p>
          </div>

          {(!securitySigned || !thirdPartyConsent) && (
            <p className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Vui lòng tích đủ các xác nhận pháp lý phía trên để mở nút Đăng ký.
            </p>
          )}

          {errorMessage && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {successMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#B8860B] px-6 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(212,175,55,0.55)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Đang xử lý..." : "Đăng ký"}
          </button>
        </form>

        <PolicyModal
          type={policyModal ?? "terms"}
          isOpen={policyModal !== null}
          onClose={() => setPolicyModal(null)}
          onSwitch={(t) => setPolicyModal(t)}
        />

        <p className="mt-5 text-sm text-gray-300">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-semibold text-[#D4AF37] hover:underline">
            Đăng nhập ngay
          </Link>
        </p>
      </div>
    </main>
  );
}

