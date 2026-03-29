"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { stripRevSuffix } from "../lib/course-display-name";
import { formatPriceDisplay } from "../lib/course-price";
import { getCourseDisplayStatus } from "../lib/course-status";
import { daysUntil } from "../lib/course-lifecycle";
import { getEffectiveDiscountPercent, parsePromotionTiers } from "../lib/promotion-tiers";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import PromotionTiersCachHai from "./PromotionTiersCachHai";

export type MonthlyCourseCard = {
  id: string;
  name: string;
  price_cents: number | null;
  discount_percent?: number | null;
  promotion_tiers?: unknown;
  active_enrollment_count?: number;
  registration_open_at: string | null;
  registration_close_at: string | null;
  course_start_at: string | null;
  course_end_at: string | null;
  base_course: { name?: string; summary?: string } | null;
  program: { name?: string } | null;
};

type Props = {
  courses: MonthlyCourseCard[];
  enrolledCourseIdByRegularId: Record<string, string>;
};

export default function LandingMonthlyCourses({
  courses,
  enrolledCourseIdByRegularId,
}: Props) {
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const c of courses) {
      m[c.id] = Math.max(0, Math.floor(Number(c.active_enrollment_count) || 0));
    }
    return m;
  });

  const idsKey = useMemo(() => courses.map((c) => c.id).join(","), [courses]);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const c of courses) {
      next[c.id] = Math.max(0, Math.floor(Number(c.active_enrollment_count) || 0));
    }
    setCounts(next);
  }, [courses, idsKey]);

  useEffect(() => {
    const ids = idsKey.split(",").filter(Boolean);
    if (!ids.length) return;
    const supabase = getSupabaseBrowserClient();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (!url.startsWith("http")) {
      return;
    }

    const ch = supabase.channel("landing-monthly-course-counts");
    for (const id of ids) {
      ch.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "regular_courses",
          filter: `id=eq.${id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as { id?: string; active_enrollment_count?: number };
          const rid = row.id;
          if (typeof rid === "string" && typeof row.active_enrollment_count === "number") {
            setCounts((prev) => ({ ...prev, [rid]: row.active_enrollment_count! }));
          }
        }
      );
    }
    ch.subscribe();

    const poll = window.setInterval(async () => {
      try {
        const res = await fetch(
          `/api/catalog/enrollment-counts?ids=${encodeURIComponent(ids.join(","))}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          counts?: { id: string; active_enrollment_count: number }[];
        };
        setCounts((prev) => {
          const merged = { ...prev };
          for (const row of data.counts ?? []) {
            merged[row.id] = row.active_enrollment_count;
          }
          return merged;
        });
      } catch {
        /* ignore */
      }
    }, 28_000);

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(ch);
    };
  }, [idsKey]);

  if (!courses.length) return null;

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => {
        const base = c.base_course;
        const program = c.program;
        const n = counts[c.id] ?? 0;
        const effectiveDiscount = getEffectiveDiscountPercent(
          c.promotion_tiers,
          c.discount_percent,
          n
        );
        const price = Number(c.price_cents) || 0;
        const priceInfo = formatPriceDisplay(price, effectiveDiscount);
        const status = getCourseDisplayStatus(
          c.registration_open_at,
          c.registration_close_at,
          c.course_end_at
        );
        const statusClass =
          status === "sắp mở"
            ? "bg-amber-500/20 text-amber-300"
            : status === "đang mở đăng ký"
              ? "bg-emerald-500/20 text-emerald-300"
              : "bg-gray-500/20 text-gray-400";
        const isEnrolled = enrolledCourseIdByRegularId[c.id] != null;
        const daysUntilRegClose = daysUntil(c.registration_close_at);
        const daysUntilCourseEnd = daysUntil(c.course_end_at);
        const showTiers = parsePromotionTiers(c.promotion_tiers) != null;

        return (
          <div
            key={c.id}
            className="block rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-[#D4AF37]/40 hover:bg-white/10"
          >
            <Link href={`/courses/${c.id}`} className="block">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold text-white">{stripRevSuffix(c.name) || c.name}</h3>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {isEnrolled ? (
                    <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                      Đã đăng ký
                    </span>
                  ) : (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}>
                      {status}
                    </span>
                  )}
                </div>
              </div>
              {(stripRevSuffix(program?.name) || program?.name) && (
                <p className="mt-1 text-sm text-gray-400">
                  {stripRevSuffix(program?.name) || program?.name}
                </p>
              )}
              {base?.summary && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-300">{base.summary}</p>
              )}
              {showTiers && (
                <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <PromotionTiersCachHai
                    activeEnrollmentCount={n}
                    promotionTiers={c.promotion_tiers}
                  />
                </div>
              )}
              <div className="mt-3 space-y-2 text-xs text-gray-500">
                <div>
                  <p className="mb-0.5 font-medium text-gray-400">Đăng ký</p>
                  <dl className="space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <dt>Mở:</dt>
                      <dd>
                        {c.registration_open_at
                          ? new Date(c.registration_open_at).toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Đóng:</dt>
                      <dd>
                        {c.registration_close_at
                          ? new Date(c.registration_close_at).toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div>
                  <p className="mb-0.5 font-medium text-gray-400">Thời gian học</p>
                  <dl className="space-y-0.5">
                    <div className="flex justify-between gap-2">
                      <dt>Bắt đầu:</dt>
                      <dd>
                        {c.course_start_at
                          ? new Date(c.course_start_at).toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Kết thúc:</dt>
                      <dd>
                        {c.course_end_at
                          ? new Date(c.course_end_at).toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
              {(daysUntilRegClose != null && !isEnrolled) || daysUntilCourseEnd != null ? (
                <div className="mt-3 space-y-1 text-xs">
                  {daysUntilRegClose != null && !isEnrolled && (
                    <p className="text-amber-400">Còn {daysUntilRegClose} ngày để đăng ký</p>
                  )}
                  {daysUntilCourseEnd != null && (
                    <p className="text-gray-400">Còn {daysUntilCourseEnd} ngày kết thúc khóa học</p>
                  )}
                </div>
              ) : null}
              <div className="mt-4">
                {priceInfo.hasDiscount && effectiveDiscount != null ? (
                  <p className="font-bold text-[#D4AF37]">
                    <span className="line-through text-gray-500">{priceInfo.originalDisplay}</span>
                    <span className="ml-2">{priceInfo.saleDisplay}</span>
                    <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
                      -{effectiveDiscount}%
                    </span>
                  </p>
                ) : (
                  <p className="font-bold text-[#D4AF37]">{priceInfo.display}</p>
                )}
              </div>
            </Link>
            {isEnrolled ? (
              <Link
                href={`/learn/${enrolledCourseIdByRegularId[c.id]}`}
                className="mt-3 inline-block rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black hover:bg-[#E7C768]"
              >
                Vào học
              </Link>
            ) : (
              <Link
                href={`/courses/${c.id}`}
                className="mt-2 inline-block text-sm text-[#D4AF37] hover:underline"
              >
                Xem chi tiết →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
