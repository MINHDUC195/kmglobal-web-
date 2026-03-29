"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { daysUntil } from "../lib/course-lifecycle";
import { getCourseDisplayStatus } from "../lib/course-status";
import { formatPriceDisplay } from "../lib/course-price";
import { stripRevSuffix } from "../lib/course-display-name";
import { getEffectiveDiscountPercent, parsePromotionTiers } from "../lib/promotion-tiers";
import PromotionTiersCachHai from "./PromotionTiersCachHai";

type CourseCard = {
  id: string;
  name: string;
  price_cents: number | null;
  discount_percent?: number | null;
  promotion_tiers?: unknown;
  active_enrollment_count?: number;
  registration_open_at?: string | null;
  registration_close_at?: string | null;
  course_start_at?: string | null;
  course_end_at?: string | null;
  base_course?: { name?: string; summary?: string } | null;
  program?: { id?: string; name?: string } | null;
};

type CoursesCatalogClientProps = {
  courses: CourseCard[];
  enrolledByCourse: Record<string, string>;
};

export default function CoursesCatalogClient({
  courses,
  enrolledByCourse,
}: CoursesCatalogClientProps) {
  const [selectedProgramId, setSelectedProgramId] = useState("all");

  const programOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of courses) {
      const id = c.program?.id?.trim();
      const name = c.program?.name?.trim();
      if (!id || !name) continue;
      if (!map.has(id)) map.set(id, name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [courses]);

  const filteredCourses = useMemo(() => {
    if (selectedProgramId === "all") return courses;
    return courses.filter((c) => c.program?.id === selectedProgramId);
  }, [courses, selectedProgramId]);

  if (!courses.length) {
    return (
      <div className="mt-12 rounded-xl border border-white/10 bg-white/5 p-12 text-center">
        <p className="text-gray-400">Chưa có khóa học nào đang mở đăng ký.</p>
        <p className="mt-2 text-sm text-gray-500">Vui lòng quay lại sau.</p>
        <Link href="/" className="mt-6 inline-block text-[#D4AF37] hover:underline">
          ← Về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label htmlFor="program-filter" className="text-sm font-medium text-gray-300">
          Chương trình:
        </label>
        <select
          id="program-filter"
          value={selectedProgramId}
          onChange={(e) => setSelectedProgramId(e.target.value)}
          className="rounded-full border border-[#2A4D77] bg-[#0A1A30] px-4 py-2 text-sm text-gray-100 outline-none focus:border-[#D4AF37]"
        >
          <option value="all">Tất cả chương trình</option>
          {programOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {stripRevSuffix(p.name) || p.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-400">Hiển thị {filteredCourses.length} khóa học</span>
      </div>

      {filteredCourses.length ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((c) => {
            const base = c.base_course ?? null;
            const program = c.program ?? null;
            const price = Number(c.price_cents) || 0;
            const n = Math.max(0, Math.floor(Number(c.active_enrollment_count) || 0));
            const discount = getEffectiveDiscountPercent(c.promotion_tiers, c.discount_percent, n);
            const priceInfo = formatPriceDisplay(price, discount);
            const showTiers = parsePromotionTiers(c.promotion_tiers) != null;
            const status = getCourseDisplayStatus(
              c.registration_open_at ?? null,
              c.registration_close_at ?? null,
              c.course_end_at ?? null
            );
            const statusClass =
              status === "sắp mở"
                ? "bg-amber-500/20 text-amber-300"
                : status === "đang mở đăng ký"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-gray-500/20 text-gray-400";
            const isEnrolled = Boolean(enrolledByCourse[c.id]);
            const daysUntilRegClose = daysUntil(c.registration_close_at ?? null);
            const daysUntilCourseEnd = daysUntil(c.course_end_at ?? null);
            return (
              <div
                key={c.id}
                className="block rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-[#D4AF37]/40 hover:bg-white/10"
              >
                <Link href={`/courses/${c.id}`} className="block">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="font-semibold text-white">{stripRevSuffix(c.name) || c.name}</h2>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {isEnrolled ? (
                        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                          Đã đăng ký
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
                        >
                          {status}
                        </span>
                      )}
                    </div>
                  </div>
                  {program?.name && (
                    <p className="mt-1 text-sm text-gray-400">{stripRevSuffix(program.name) || program.name}</p>
                  )}
                  {base?.summary && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-300">{base.summary}</p>
                  )}
                  {showTiers && (
                    <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                      <PromotionTiersCachHai activeEnrollmentCount={n} promotionTiers={c.promotion_tiers} />
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
                    {priceInfo.hasDiscount && discount != null ? (
                      <p className="font-bold text-[#D4AF37]">
                        <span className="line-through text-gray-500">{priceInfo.originalDisplay}</span>
                        <span className="ml-2">{priceInfo.saleDisplay}</span>
                        <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-300">
                          -{discount}%
                        </span>
                      </p>
                    ) : (
                      <p className="font-bold text-[#D4AF37]">{priceInfo.display}</p>
                    )}
                  </div>
                </Link>
                {isEnrolled ? (
                  <Link
                    href={`/learn/${enrolledByCourse[c.id]}`}
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
      ) : (
        <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-gray-300">Chưa có khóa học thuộc chương trình này đang mở.</p>
        </div>
      )}
    </>
  );
}
