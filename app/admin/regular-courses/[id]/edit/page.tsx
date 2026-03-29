"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AdminBreadcrumbStrip } from "../../../../../components/AdminHierarchyBreadcrumb";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase-browser";

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
      if (!discountPercentLocked) {
        if (discountVal !== null && (discountVal < 1 || discountVal > 99)) {
          throw new Error("Giảm giá phải từ 1-99%");
        }
      }

      const patch: Record<string, string | number | null> = {
        name: name.trim(),
        price_cents: priceVal,
        registration_open_at: fromLocalDateTime(registrationOpenAt),
        registration_close_at: fromLocalDateTime(registrationCloseAt),
        course_start_at: fromLocalDateTime(courseStartAt),
        course_end_at: fromLocalDateTime(courseEndAt),
        updated_at: new Date().toISOString(),
      };
      if (!discountPercentLocked) {
        patch.discount_percent = discountVal;
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
            <label className="mb-1 block text-sm font-medium text-white/90">Giảm giá (%)</label>
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
                : "1-99%. Để trống nếu không giảm giá."}
            </p>
          </div>

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
