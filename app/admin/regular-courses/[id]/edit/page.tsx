"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AdminBreadcrumbStrip } from "../../../../../components/AdminHierarchyBreadcrumb";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase-browser";
import { parsePromotionTiers } from "../../../../../lib/promotion-tiers";

function toLocalDateTime(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function fromLocalDateTime(local: string): string | null {
  if (!local?.trim()) return null;
  try {
    return new Date(local).toISOString();
  } catch {
    return null;
  }
}

export default function EditRegularCoursePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = getSupabaseBrowserClient();

  const [name, setName] = useState("");
  const [priceCents, setPriceCents] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [registrationOpenAt, setRegistrationOpenAt] = useState("");
  const [registrationCloseAt, setRegistrationCloseAt] = useState("");
  const [courseStartAt, setCourseStartAt] = useState("");
  const [courseEndAt, setCourseEndAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [programId, setProgramId] = useState("");
  const [programName, setProgramName] = useState("");
  const [baseCourseId, setBaseCourseId] = useState<string | null>(null);
  const [baseCourseName, setBaseCourseName] = useState("");
  const [discountPercentLocked, setDiscountPercentLocked] = useState(false);
  const [promotionTiersJson, setPromotionTiersJson] = useState("");
  /** Giống modal nhân bản: chỉ hiển thị một nhóm — % cố định hoặc JSON ưu đãi theo suất */
  const [pricingMode, setPricingMode] = useState<"flat" | "tiers">("flat");

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from("regular_courses")
        .select(`
          *,
          program:programs(id, name),
          base_course:base_courses(id, name)
        `)
        .eq("id", id)
        .single();
      if (err || !data) {
        setError("Không tìm thấy khóa học thường");
        return;
      }
      setName(data.name ?? "");
      setPriceCents(data.price_cents != null ? String(data.price_cents) : "");
      setDiscountPercent(data.discount_percent != null ? String(data.discount_percent) : "");
      setRegistrationOpenAt(toLocalDateTime(data.registration_open_at));
      setRegistrationCloseAt(toLocalDateTime(data.registration_close_at));
      setCourseStartAt(toLocalDateTime(data.course_start_at));
      setCourseEndAt(toLocalDateTime(data.course_end_at));
      const prog = data.program as { id?: string; name?: string } | null;
      setProgramId(prog?.id ?? "");
      setProgramName(prog?.name?.trim() || "");
      const bc = data.base_course as { id?: string; name?: string } | null;
      if (bc?.id) {
        setBaseCourseId(bc.id);
        setBaseCourseName(bc.name?.trim() || "");
      }
      const locked = (data as { discount_percent_locked?: boolean }).discount_percent_locked === true;
      setDiscountPercentLocked(locked);
      const pt = (data as { promotion_tiers?: unknown }).promotion_tiers;
      setPromotionTiersJson(pt != null ? JSON.stringify(pt, null, 2) : "");
      setPricingMode(parsePromotionTiers(pt) != null ? "tiers" : "flat");
    }
    void load().finally(() => setLoading(false));
  }, [id, supabase]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const priceVal = priceCents.trim() ? Math.round(parseFloat(priceCents)) : 0;
      if (priceVal < 0) throw new Error("Giá không hợp lệ");
      const discountVal = discountPercent.trim()
        ? Math.min(99, Math.max(0, Math.round(parseFloat(discountPercent))))
        : null;

      const patch: Record<string, unknown> = {
        name: name.trim(),
        price_cents: priceVal,
        registration_open_at: fromLocalDateTime(registrationOpenAt),
        registration_close_at: fromLocalDateTime(registrationCloseAt),
        course_start_at: fromLocalDateTime(courseStartAt),
        course_end_at: fromLocalDateTime(courseEndAt),
        updated_at: new Date().toISOString(),
      };

      if (pricingMode === "flat") {
        if (!discountPercentLocked) {
          if (discountVal !== null && (discountVal < 0 || discountVal > 99)) {
            throw new Error("Giảm giá phải từ 0–99%");
          }
          patch.discount_percent = discountVal;
        }
        patch.promotion_tiers = null;
      } else {
        const tiersTrim = promotionTiersJson.trim();
        if (!tiersTrim) {
          throw new Error('Ưu đãi theo suất: nhập JSON hợp lệ hoặc chọn lại "Giảm giá cố định (%)".');
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(tiersTrim) as unknown;
        } catch {
          throw new Error("promotion_tiers: JSON không hợp lệ");
        }
        if (!parsePromotionTiers(parsed)) {
          throw new Error(
            "promotion_tiers: cần ≥2 phần tử, các đợt trước có slots nguyên ≥1, phần tử cuối có \"slots\": null và discount_percent nguyên 0–99."
          );
        }
        patch.promotion_tiers = parsed as object;
        if (!discountPercentLocked) {
          patch.discount_percent = null;
        }
      }

      const { error: err } = await supabase.from("regular_courses").update(patch).eq("id", id);

      if (err) throw new Error(err.message);
      router.push(`/admin/regular-courses/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi cập nhật");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-gray-400">Đang tải...</p>
        </main>
    );
  }

  if (error && !name) {
    return (
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-red-400">{error}</p>
          <Link href={programId ? `/admin/programs/${programId}` : "/admin/programs"} className="mt-4 inline-block text-[#D4AF37] hover:underline">
            ← Về chương trình
          </Link>
        </main>
    );
  }

  const editRegularBreadcrumb = [
    { label: "Chương trình", href: "/admin/programs" },
    ...(programId
      ? [{ label: programName || "Chương trình", href: `/admin/programs/${programId}` }]
      : []),
    ...(baseCourseId
      ? [{ label: baseCourseName || "Khóa học cơ bản", href: `/admin/base-courses/${baseCourseId}` }]
      : []),
    { label: name || "Khóa học thường", href: `/admin/regular-courses/${id}` },
    { label: "Chỉnh sửa khóa học thường" },
  ];

  return (
    <>
      <AdminBreadcrumbStrip items={editRegularBreadcrumb} />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Chỉnh sửa khóa học thường
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Tên khóa học *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Giá (VNĐ)</label>
            <input
              type="number"
              min="0"
              step="1000"
              value={priceCents}
              onChange={(e) => setPriceCents(e.target.value)}
              placeholder="VD: 990000"
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            />
            <p className="mt-1 text-xs text-gray-500">Nhập số tiền (VNĐ). Ví dụ: 990000</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Cách áp dụng giá / ưu đãi</label>
            <select
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as "flat" | "tiers")}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            >
              <option value="flat">Giảm giá cố định (%)</option>
              <option value="tiers">Ưu đãi theo suất</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Chọn một: hoặc một mức % cố định, hoặc các đợt theo số suất (JSON; đợt cuối không giới hạn suất). Khi lưu, chỉ cách bạn chọn được giữ — cách kia sẽ được gỡ (JSON xóa hoặc % cố định không còn dùng khi có JSON).
            </p>
          </div>

          {pricingMode === "flat" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">Giảm giá cố định (%)</label>
              <input
                type="number"
                min="0"
                max="99"
                step="1"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="VD: 10 (để trống = không giảm)"
                disabled={discountPercentLocked}
                className={`w-full rounded-xl border border-white/15 px-4 py-3 text-white outline-none focus:border-[#D4AF37] ${
                  discountPercentLocked
                    ? "cursor-not-allowed bg-[#0b1323]/60 text-gray-400"
                    : "bg-[#0b1323]"
                }`}
              />
              <p className="mt-1 text-xs text-gray-500">
                {discountPercentLocked
                  ? "Giảm giá đã cố định khi tạo khóa từ nhân bản. Không chỉnh sau để tránh lệch giá thanh toán hoặc nhiều yêu cầu thanh toán cho cùng học viên."
                  : "0–99%. Để trống nếu không giảm giá."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#0b1323]/50 p-4">
              <label className="mb-2 block text-sm font-medium text-white/90">Ưu đãi theo suất (JSON)</label>
              <p className="mb-3 text-xs text-gray-500">
                Các đợt có giới hạn suất, rồi một phần tử cuối với <code className="text-gray-400">slots: null</code> (không giới hạn suất).{" "}
                <code className="text-gray-400">discount_percent</code> mỗi đợt: số nguyên 0–99 (đợt cuối có thể 0% = giá gốc sau các đợt có suất).
              </p>
              <textarea
                value={promotionTiersJson}
                onChange={(e) => setPromotionTiersJson(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={`[\n  { "slots": 50, "discount_percent": 50 },\n  { "slots": 20, "discount_percent": 30 },\n  { "slots": null, "discount_percent": 0 }\n]`}
                className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 font-mono text-sm text-white outline-none focus:border-[#D4AF37]"
              />
              <p className="mt-2 text-xs text-gray-500">
                Khi lưu với chế độ này, giá bán chỉ theo các đợt. Nếu % cố định chưa bị khóa, hệ thống sẽ đặt lại thành không dùng (null).
                {discountPercentLocked ? (
                  <>
                    {" "}
                    Nếu % cố định đã khóa từ lúc tạo khóa, cột trong CSDL có thể còn giá trị cũ nhưng không ảnh hưởng giá khi JSON hợp lệ.
                  </>
                ) : null}
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Mở đăng ký</label>
            <input
              type="datetime-local"
              value={registrationOpenAt}
              onChange={(e) => setRegistrationOpenAt(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Đóng đăng ký</label>
            <input
              type="datetime-local"
              value={registrationCloseAt}
              onChange={(e) => setRegistrationCloseAt(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Bắt đầu khóa</label>
            <input
              type="datetime-local"
              value={courseStartAt}
              onChange={(e) => setCourseStartAt(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Kết thúc khóa</label>
            <input
              type="datetime-local"
              value={courseEndAt}
              onChange={(e) => setCourseEndAt(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-60"
            >
              {submitting ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
            <Link
              href={`/admin/regular-courses/${id}`}
              className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
            >
              Hủy
            </Link>
          </div>
        </form>

        <Link
          href={`/admin/regular-courses/${id}`}
          className="mt-6 inline-block text-sm text-[#D4AF37] hover:underline"
        >
          ← Về chi tiết khóa học
        </Link>
      </main>
    </>
  );
}
