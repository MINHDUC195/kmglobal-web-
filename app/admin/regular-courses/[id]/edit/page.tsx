"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AdminBreadcrumbStrip } from "../../../../../components/AdminHierarchyBreadcrumb";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase-browser";
import {
  buildPromotionTiersFromFormRows,
  parsePromotionTiers,
  promotionTiersToFormRows,
} from "../../../../../lib/promotion-tiers";

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
  /** Đợt có giới hạn suất + đuôi (chế độ ưu đãi theo suất) */
  const [tierCappedRows, setTierCappedRows] = useState<{ slots: string; discount: string }[]>([
    { slots: "", discount: "" },
  ]);
  const [tierTailDiscount, setTierTailDiscount] = useState("");
  /** Chỉ một nhóm: % cố định hoặc ưu đãi theo suất */
  const [pricingMode, setPricingMode] = useState<"flat" | "tiers">("flat");
  /** null = chưa tải xong; chỉ cho sửa khi draft */
  const [approvalStatus, setApprovalStatus] = useState<string | null>(null);

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
      const { rows, tailDiscount } = promotionTiersToFormRows(pt);
      setTierCappedRows(rows);
      setTierTailDiscount(tailDiscount);
      setPricingMode(parsePromotionTiers(pt) != null ? "tiers" : "flat");
      setApprovalStatus(
        (data as { approval_status?: string | null }).approval_status ?? "pending"
      );
    }
    void load().finally(() => setLoading(false));
  }, [id, supabase]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (approvalStatus !== "draft") {
        throw new Error("Không thể lưu: chỉ khóa ở trạng thái nháp mới được chỉnh sửa.");
      }
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
        const parsed = buildPromotionTiersFromFormRows(tierCappedRows, tierTailDiscount);
        patch.promotion_tiers = parsed;
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

  if (!loading && approvalStatus !== null && approvalStatus !== "draft") {
    const editRegularBreadcrumbLocked = [
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
        <AdminBreadcrumbStrip items={editRegularBreadcrumbLocked} />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
          <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
            Chỉnh sửa khóa học thường
          </h1>
          <div
            className={`mt-6 max-w-xl rounded-xl border px-4 py-4 text-sm ${
              approvalStatus === "pending"
                ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {approvalStatus === "pending" ? (
              <p>
                Khóa đã <strong>gửi phê duyệt hiển thị</strong> — không thể chỉnh sửa cho đến khi Owner xử lý.
                Nếu Owner <strong>từ chối</strong>, khóa trở về trạng thái nháp và bạn có thể sửa rồi gửi lại.
              </p>
            ) : (
              <p>
                Khóa đã được <strong>phê duyệt hiển thị</strong> — không mở form chỉnh sửa tại đây.
              </p>
            )}
          </div>
          <Link
            href={`/admin/regular-courses/${id}`}
            className="mt-6 inline-block text-sm font-semibold text-[#D4AF37] hover:underline"
          >
            ← Về chi tiết khóa học
          </Link>
        </main>
      </>
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
              Chọn một: hoặc một mức % cố định, hoặc các đợt theo số suất (đợt cuối không giới hạn suất). Khi lưu, chỉ cách bạn chọn được giữ — cách kia sẽ được gỡ.
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
              <label className="mb-2 block text-sm font-medium text-white/90">Ưu đãi theo suất</label>
              <p className="mb-3 text-xs text-gray-500">
                Thêm từng đợt có giới hạn suất, rồi mức % cho đợt không giới hạn suất (sau các đợt trước). Mỗi đợt: % giảm 0–99. Đợt cuối để trống = 0% (giá gốc sau các đợt có suất).
              </p>
              <div className="space-y-3">
                {tierCappedRows.map((row, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-[#0a1628] p-2"
                  >
                    <div className="min-w-[7rem] flex-1">
                      <span className="mb-0.5 block text-[11px] text-gray-500">Đợt {idx + 1} · Số suất</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={row.slots}
                        onChange={(e) => {
                          const v = e.target.value;
                          setTierCappedRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, slots: v } : r))
                          );
                        }}
                        placeholder="VD: 50"
                        className="w-full rounded-md border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div className="min-w-[7rem] flex-1">
                      <span className="mb-0.5 block text-[11px] text-gray-500">Giảm giá (%)</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        value={row.discount}
                        onChange={(e) => {
                          const v = e.target.value;
                          setTierCappedRows((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, discount: v } : r))
                          );
                        }}
                        placeholder="VD: 30"
                        className="w-full rounded-md border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    {tierCappedRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setTierCappedRows((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="shrink-0 rounded-md border border-red-500/40 px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                      >
                        Xóa đợt
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setTierCappedRows((prev) => [...prev, { slots: "", discount: "" }])
                  }
                  className="text-xs font-medium text-[#D4AF37] hover:underline"
                >
                  + Thêm đợt có giới hạn suất
                </button>
                <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-2">
                  <span className="mb-0.5 block text-[11px] font-medium text-amber-200/90">
                    Đợt cuối — không giới hạn suất
                  </span>
                  <div className="max-w-[10rem]">
                    <span className="mb-0.5 block text-[11px] text-gray-500">Giảm giá (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={tierTailDiscount}
                      onChange={(e) => setTierTailDiscount(e.target.value)}
                      placeholder="Trống = 0%"
                      className="w-full rounded-md border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Khi lưu với chế độ này, giá bán chỉ theo các đợt. Nếu % cố định chưa bị khóa, hệ thống sẽ đặt lại thành không dùng (null).
                {discountPercentLocked ? (
                  <>
                    {" "}
                    Nếu % cố định đã khóa, cột trong CSDL có thể còn giá trị cũ nhưng không ảnh hưởng giá khi cấu hình đợt hợp lệ.
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
