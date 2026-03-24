"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type LegalRow = {
  slug: string;
  intro: string | null;
  body: string;
  updated_at?: string;
};

const TERMS = "terms-of-service";
const PRIVACY = "privacy-policy";

export default function OwnerLegalEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tab, setTab] = useState<"terms" | "privacy">("terms");

  const [termsIntro, setTermsIntro] = useState("");
  const [termsBody, setTermsBody] = useState("");
  const [privacyIntro, setPrivacyIntro] = useState("");
  const [privacyBody, setPrivacyBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/legal");
      const data = await res.json();
      if (res.status === 403) {
        setError("Bạn không có quyền truy cập.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Không tải được dữ liệu.");
        return;
      }
      const pages = data.pages as Record<string, LegalRow>;
      const t = pages[TERMS];
      const p = pages[PRIVACY];
      if (t) {
        setTermsIntro(t.intro ?? "");
        setTermsBody(t.body ?? "");
      }
      if (p) {
        setPrivacyIntro(p.intro ?? "");
        setPrivacyBody(p.body ?? "");
      }
    } catch {
      setError("Lỗi mạng. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/owner/legal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [TERMS]: { intro: termsIntro, body: termsBody },
          [PRIVACY]: { intro: privacyIntro, body: privacyBody },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lưu thất bại.");
        return;
      }
      setSuccess(true);
      void load();
    } catch {
      setError("Lỗi mạng. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href="/owner" className="text-sm text-gray-400 hover:text-[#D4AF37]">
          ← Dashboard Owner
        </Link>
      </div>

      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Soạn thảo điều khoản & chính sách
      </h1>
      <p className="mt-2 max-w-2xl text-gray-400">
        Nội dung hiển thị công khai tại trang Điều khoản sử dụng và Chính sách bảo mật. Ngắt đoạn bằng một dòng trống
        (Enter hai lần) để tạo đoạn văn mới.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          Đã lưu thành công.
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-gray-500">Đang tải...</p>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={() => setTab("terms")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === "terms"
                  ? "bg-[#D4AF37] text-black"
                  : "border border-white/20 text-gray-300 hover:border-[#D4AF37]/50"
              }`}
            >
              Điều khoản sử dụng
            </button>
            <button
              type="button"
              onClick={() => setTab("privacy")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                tab === "privacy"
                  ? "bg-[#D4AF37] text-black"
                  : "border border-white/20 text-gray-300 hover:border-[#D4AF37]/50"
              }`}
            >
              Chính sách bảo mật
            </button>
          </div>

          {tab === "terms" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Đoạn mô tả ngắn (dưới tiêu đề)</label>
                <textarea
                  value={termsIntro}
                  onChange={(e) => setTermsIntro(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#0f1c33] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-[#D4AF37]/60 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                  placeholder="Giới thiệu ngắn..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nội dung chính</label>
                <textarea
                  value={termsBody}
                  onChange={(e) => setTermsBody(e.target.value)}
                  rows={18}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#0f1c33] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-gray-500 focus:border-[#D4AF37]/60 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                  placeholder="Soạn nội dung điều khoản..."
                />
              </div>
            </div>
          )}

          {tab === "privacy" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Đoạn mô tả ngắn (dưới tiêu đề)</label>
                <textarea
                  value={privacyIntro}
                  onChange={(e) => setPrivacyIntro(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#0f1c33] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-[#D4AF37]/60 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                  placeholder="Giới thiệu ngắn..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300">Nội dung chính</label>
                <textarea
                  value={privacyBody}
                  onChange={(e) => setPrivacyBody(e.target.value)}
                  rows={18}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#0f1c33] px-4 py-3 text-sm leading-relaxed text-white placeholder:text-gray-500 focus:border-[#D4AF37]/60 focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40"
                  placeholder="Soạn nội dung chính sách..."
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-[#e4c657] disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu tất cả"}
            </button>
            <Link
              href="/terms-of-service"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[#D4AF37]/90 hover:underline"
            >
              Xem trước — Điều khoản
            </Link>
            <Link
              href="/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[#D4AF37]/90 hover:underline"
            >
              Xem trước — Chính sách
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
