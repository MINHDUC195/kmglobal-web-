"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import DashboardNav from "../../components/DashboardNav";
import Footer from "../../components/Footer";
import { fetchWithRetry } from "../../lib/fetch-retry";

function CheckoutPageContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("courseId");
  const [course, setCourse] = useState<{ id: string; name: string; price_cents: number; discount_percent?: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const res = await fetch(`/api/courses/${courseId}`);
        if (res.ok) {
          const data = await res.json();
          setCourse(data);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [courseId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>, gateway: string) {
    e.preventDefault();
    if (!courseId || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const res = await fetchWithRetry("/api/checkout/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, gateway, idempotencyKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Lỗi khởi tạo thanh toán");
        return;
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setError("Lỗi kết nối");
    } finally {
      setSubmitting(false);
    }
  }

  if (!courseId) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Học viên" />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-amber-400">Thiếu thông tin khóa học. Chọn khóa từ trang Khóa học.</p>
          <Link href="/courses" className="mt-4 inline-block text-[#D4AF37] hover:underline">
            ← Khám phá khóa học
          </Link>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Học viên" />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-gray-400">Đang tải...</p>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Học viên" />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-amber-400">Không tìm thấy khóa học.</p>
          <Link href="/courses" className="mt-4 inline-block text-[#D4AF37] hover:underline">
            ← Khám phá khóa học
          </Link>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  const priceVnd = Number(course.price_cents) || 0;
  const discount = course.discount_percent ?? null;
  const formatPrice = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";
  const salePriceVnd = discount && discount >= 1 && discount <= 99
    ? Math.round((priceVnd * (100 - discount)) / 100)
    : priceVnd;

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Học viên" showExploreCourses />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Thanh toán
        </h1>
        <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-6">
          <p className="font-medium text-white">{course.name}</p>
          {salePriceVnd < priceVnd && discount ? (
            <p className="mt-2 text-2xl font-bold text-[#D4AF37]">
              <span className="line-through text-gray-500 text-lg">{formatPrice(priceVnd)}</span>
              <span className="ml-2">{formatPrice(salePriceVnd)}</span>
              <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-sm font-semibold text-red-300">
                -{discount}%
              </span>
            </p>
          ) : (
            <p className="mt-2 text-2xl font-bold text-[#D4AF37]">{formatPrice(priceVnd)}</p>
          )}
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-white">Chọn phương thức thanh toán</h2>
          <form className="space-y-3" onSubmit={(e) => handleSubmit(e, "vnpay")}>
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 disabled:opacity-50"
            >
              <span className="font-medium text-white">VNPay (QR / Chuyển khoản)</span>
              <span className="text-[#D4AF37]">→</span>
            </button>
          </form>
          <form className="mt-3" onSubmit={(e) => handleSubmit(e, "momo")}>
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 disabled:opacity-50"
            >
              <span className="font-medium text-white">Ví MoMo</span>
              <span className="text-[#D4AF37]">→</span>
            </button>
          </form>
          <form className="mt-3" onSubmit={(e) => handleSubmit(e, "stripe")}>
            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-left transition hover:bg-white/10 disabled:opacity-50"
            >
              <span className="font-medium text-white">Thẻ Visa / Quốc tế (Stripe)</span>
              <span className="text-[#D4AF37]">→</span>
            </button>
          </form>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}

        <Link href="/courses" className="mt-8 inline-block text-sm text-[#D4AF37] hover:underline">
          ← Quay lại Khóa học
        </Link>
      </main>

      <Footer hideLogo />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a1628] px-6 py-12 text-center text-gray-400">
          Đang tải...
        </div>
      }
    >
      <CheckoutPageContent />
    </Suspense>
  );
}
