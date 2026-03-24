"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import NavLogoWithBanner from "../../components/NavLogoWithBanner";

type CertificateData = {
  code: string;
  fullName: string;
  emailMasked: string;
  courseName: string;
  courseCode: string;
  percentScore: number;
  issuedAt: string;
};

function VerifyPageContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") || "";
  const [code, setCode] = useState(codeFromUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<CertificateData | null>(null);

  useEffect(() => {
    setCode(codeFromUrl || "");
    if (codeFromUrl) {
      setError("");
      setData(null);
      void doSearch(codeFromUrl);
    }
  }, [codeFromUrl]);

  async function doSearch(searchCode: string) {
    const trimmed = searchCode.trim().toUpperCase();
    if (!trimmed || trimmed.length < 5) {
      setError("Vui lòng nhập mã chứng chỉ (ví dụ: KM-XXXXXXXXXXXX)");
      setData(null);
      return;
    }

    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/verify/certificate?code=${encodeURIComponent(trimmed)}`);
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Không tìm thấy chứng chỉ");
        return;
      }

      setData(result);
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void doSearch(code);
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  return (
    <main className="min-h-screen bg-[#0a1628] text-white">
      <nav className="border-b border-white/8 bg-[#0a1628]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[var(--container-max)] items-center justify-between px-4 py-3 sm:px-6">
          <NavLogoWithBanner />
          <Link
            href="/"
            className="rounded-full border border-[#D4AF37]/50 px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            Trang chủ
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-serif)] text-3xl font-bold uppercase text-[#D4AF37]">
          Xác minh chứng chỉ
        </h1>
        <p className="mt-3 text-gray-400">
          Nhập mã chứng chỉ để tra cứu tính hợp lệ. Mã có dạng KM-XXXXXXXXXXXX.
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          <label htmlFor="certificate-code" className="sr-only">
            Mã chứng chỉ
          </label>
          <div className="flex gap-3">
            <input
              id="certificate-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="VD: KM-A1B2C3D4E5F6"
              autoComplete="off"
              className="flex-1 rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-[#D4AF37]"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[#D4AF37] px-8 py-3 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-60"
            >
              {loading ? "Đang tra cứu..." : "Tra cứu"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-amber-200">
            {error}
          </div>
        )}

        {data && (
          <div className="mt-8 rounded-2xl border border-[#D4AF37]/30 bg-[#111c31]/90 p-8 shadow-[0_0_35px_rgba(212,175,55,0.15)]">
            <div className="mb-6 flex items-center justify-center">
              <div className="rounded-full bg-emerald-500/20 p-3">
                <svg
                  className="h-8 w-8 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-center text-lg font-bold text-emerald-400">
              Chứng chỉ hợp lệ
            </h2>
            <dl className="mt-6 space-y-4">
              <div>
                <dt className="text-sm text-gray-500">Mã chứng chỉ</dt>
                <dd className="mt-1 font-mono font-bold text-[#D4AF37]">{data.code}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Họ và tên</dt>
                <dd className="mt-1 text-white">{data.fullName}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Email (đã che một phần)</dt>
                <dd className="mt-1 font-mono text-sm text-gray-300">{data.emailMasked}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Khóa học</dt>
                <dd className="mt-1 text-white">{data.courseName}</dd>
                {data.courseCode && (
                  <dd className="mt-0.5 text-sm text-gray-400">({data.courseCode})</dd>
                )}
              </div>
              <div>
                <dt className="text-sm text-gray-500">Điểm số</dt>
                <dd className="mt-1 text-white">{data.percentScore}%</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Ngày cấp</dt>
                <dd className="mt-1 text-white">{formatDate(data.issuedAt)}</dd>
              </div>
            </dl>
            <p className="mt-6 text-center text-sm text-gray-500">
              Chứng chỉ này được cấp bởi KM Global Academy và có thể xác minh trực tuyến.
            </p>
          </div>
        )}

        <Link
          href="/"
          className="mt-10 inline-block rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
        >
          ← Về trang chủ
        </Link>
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#0a1628] text-gray-400">
          Đang tải...
        </main>
      }
    >
      <VerifyPageContent />
    </Suspense>
  );
}
