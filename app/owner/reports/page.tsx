"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PaymentItem = {
  id: string;
  program_name: string;
  course_name: string;
  enrolled_at: string | null;
  enrolled_at_display: string;
  management_code: string;
  student_name: string;
  student_code: string;
  status: string;
  payment_status: string;
  payment_completed_at: string | null;
  payment_date_display: string;
  amount_cents: number;
  amount_display: string;
  /** Thanh toán hoàn tất 0đ theo whitelist (hiển thị nhãn cạnh số tiền) */
  is_whitelist?: boolean;
  invoice_exported_at: string | null;
  invoice_state:
    | "not_applicable"
    | "not_eligible"
    | "pending_export"
    | "exported"
    | "needs_review";
  invoice_status_label: string;
  invoice_action_label: string;
  can_export_invoice: boolean;
  /** Dòng từ đăng ký không qua cổng thanh toán (không có payment) */
  enrollment_only?: boolean;
  /** Giao dịch payment không còn user trong Auth */
  orphan_payment?: boolean;
};

type ReportMeta = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export default function OwnerReportsPage() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupSuccess, setCleanupSuccess] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const loadInFlight = useRef(false);
  const itemsRef = useRef<PaymentItem[]>([]);
  itemsRef.current = items;

  const orphanCount = useMemo(
    () => items.filter((r) => r.orphan_payment && !r.enrollment_only).length,
    [items]
  );

  const loadPayments = useCallback(async (reset = true) => {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setLoadError(null);
    try {
      const currentOffset = reset ? 0 : itemsRef.current.length;
      const res = await fetch(`/api/owner/reports/payments?limit=100&offset=${currentOffset}`);
      const data = await res.json();
      if (res.ok) {
        const raw = (data.items ?? []) as PaymentItem[];
        const seen = new Set<string>();
        const deduped = raw.filter((row) => {
          if (seen.has(row.id)) return false;
          seen.add(row.id);
          return true;
        });
        setItems((prev) => {
          if (reset) return deduped;
          const merged = [...prev];
          const existing = new Set(prev.map((x) => x.id));
          for (const row of deduped) {
            if (!existing.has(row.id)) merged.push(row);
          }
          return merged;
        });
        setMeta((data as { meta?: ReportMeta }).meta ?? null);
      } else {
        setLoadError((data as { error?: string }).error ?? "Không tải được danh sách.");
        if (reset) setItems([]);
      }
    } catch {
      setLoadError("Lỗi kết nối.");
      if (reset) setItems([]);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
      loadInFlight.current = false;
    }
  }, []);

  async function handleExportInvoice(id: string) {
    if (exporting) return;
    const row = items.find((i) => i.id === id);
    if (!row || !row.can_export_invoice) return;

    setExportError(null);
    setExporting(id);
    try {
      const res = await fetch(`/api/owner/reports/payments/${id}/export-invoice`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadPayments(true);
      } else {
        setExportError(
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : "Không thể xuất hóa đơn."
        );
      }
    } catch {
      setExportError("Lỗi kết nối.");
    } finally {
      setExporting(null);
    }
  }

  async function handleCleanupOrphans() {
    if (cleanupLoading || orphanCount === 0) return;
    if (
      !window.confirm(
        `Xóa ${orphanCount} giao dịch không còn học viên (đã xóa tài khoản)? Hành động không hoàn tác.`
      )
    ) {
      return;
    }
    setCleanupLoading(true);
    setCleanupSuccess(null);
    setCleanupError(null);
    try {
      const res = await fetch("/api/owner/reports/payments/cleanup-orphans", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof (data as { deleted?: number }).deleted === "number") {
        setCleanupSuccess(`Đã xóa ${(data as { deleted: number }).deleted} giao dịch.`);
        await loadPayments(true);
      } else {
        setCleanupError(
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : "Không thể xóa giao dịch."
        );
      }
    } catch {
      setCleanupError("Lỗi kết nối.");
    } finally {
      setCleanupLoading(false);
    }
  }

  useEffect(() => {
    void loadPayments(true);
  }, [loadPayments]);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link
          href="/owner"
          className="text-sm text-gray-400 hover:text-[#D4AF37]"
        >
          ← Dashboard Owner
        </Link>
        <span className="text-gray-600">|</span>
        <Link
          href="/owner/invoices"
          className="text-sm text-gray-400 hover:text-[#D4AF37]"
        >
          Hóa đơn VAT điện tử
        </Link>
      </div>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Báo cáo
      </h1>

      {meta && (
        <p className="mt-3 text-xs text-gray-500">
          Đang hiển thị {items.length}/{meta.total} dòng (giao dịch + đăng ký miễn phí / chờ thanh toán).
        </p>
      )}

      <div className="mt-8 rounded-[2rem] border-2 border-[#0a1628] bg-white p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="text-lg font-bold uppercase tracking-wide text-[#0a1628]">
            Thông tin thanh toán
          </h2>
          {orphanCount > 0 && (
            <button
              type="button"
              onClick={() => void handleCleanupOrphans()}
              disabled={cleanupLoading}
              className="rounded-xl border border-amber-600/60 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 disabled:opacity-60"
            >
              {cleanupLoading
                ? "Đang xóa..."
                : `Xóa giao dịch không xác định học viên (${orphanCount})`}
            </button>
          )}
        </div>

        {cleanupSuccess && (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
            {cleanupSuccess}
          </p>
        )}
        {cleanupError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {cleanupError}
          </p>
        )}

        {loadError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {loadError}
          </p>
        )}
        {exportError && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
            {exportError}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-gray-500">Đang tải...</p>
        ) : items.length === 0 ? (
          <p className="mt-6 text-gray-500">Chưa có giao dịch thanh toán nào.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse">
              <thead>
                <tr className="border-b-2 border-[#0a1628]">
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Chương trình &amp; khóa học
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Ngày đăng ký
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Học viên
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Mã HV
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Mã giao dịch
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Thanh toán
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Số tiền
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-center text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const canExportInvoice = row.can_export_invoice;
                  const actionLabel =
                    canExportInvoice && exporting === row.id
                      ? "Đang xử lý..."
                      : row.invoice_action_label;
                  const actionTone =
                    canExportInvoice && exporting !== row.id
                      ? "bg-[#0e5a77] text-white hover:bg-[#0d4d66]"
                      : row.invoice_state === "needs_review"
                        ? "cursor-default bg-amber-100 text-amber-800"
                        : "cursor-default bg-gray-300 text-gray-600";
                  return (
                    <tr
                      key={row.enrollment_only ? `enr:${row.id}` : row.id}
                      className={`border-b border-black/10 ${row.orphan_payment ? "bg-amber-50/90" : ""}`}
                    >
                      <td className="border border-black/10 px-3 py-3 text-xs text-[#0a1628] sm:text-sm">
                        {row.program_name && row.program_name !== "—" ? (
                          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                            {row.program_name}
                          </div>
                        ) : null}
                        <div className={row.program_name && row.program_name !== "—" ? "mt-0.5 font-medium" : "font-medium"}>
                          {row.course_name}
                        </div>
                      </td>
                      <td className="border border-black/10 px-3 py-3 text-xs text-[#0a1628] sm:text-sm whitespace-nowrap">
                        {row.enrolled_at_display}
                      </td>
                      <td className="border border-black/10 px-3 py-3 text-xs text-[#0a1628] sm:text-sm">
                        {row.student_name}
                      </td>
                      <td className="border border-black/10 px-3 py-3 font-mono text-xs text-[#0a1628] sm:text-sm">
                        {row.student_code}
                      </td>
                      <td className="border border-black/10 px-3 py-3 font-mono text-[11px] text-[#0a1628] sm:text-sm">
                        {row.management_code}
                      </td>
                      <td className="border border-black/10 px-3 py-3 text-xs text-[#0a1628] sm:text-sm">
                        <div className="whitespace-nowrap">{row.status}</div>
                        {row.payment_status === "completed" && row.payment_date_display !== "—" ? (
                          <div className="mt-0.5 text-[11px] text-gray-500">{row.payment_date_display}</div>
                        ) : null}
                      </td>
                      <td className="border border-black/10 px-3 py-3 text-xs text-[#0a1628] sm:text-sm whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{row.amount_display}</span>
                          {row.is_whitelist ? (
                            <span className="rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6b5a20]">
                              Whitelist
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="border border-black/10 px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => void handleExportInvoice(row.id)}
                          disabled={!canExportInvoice || exporting === row.id}
                          title={row.invoice_status_label}
                          className={`
                          rounded-lg px-3 py-2 text-xs font-medium sm:text-sm
                          ${actionTone}
                          disabled:opacity-90 disabled:cursor-not-allowed
                        `}
                        >
                          {actionLabel}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(meta?.hasMore || loadingMore) && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadPayments(false)}
                  disabled={loadingMore}
                  className="rounded-full border border-[#0a1628]/20 px-5 py-2 text-sm font-semibold text-[#0a1628] transition hover:bg-gray-100 disabled:opacity-60"
                >
                  {loadingMore ? "Đang tải thêm..." : "Tải thêm giao dịch"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
