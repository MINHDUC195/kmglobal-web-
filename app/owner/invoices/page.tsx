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
  enrollment_only?: boolean;
  orphan_payment?: boolean;
};

type ReportMeta = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type FilterKey = "vat_pending" | "vat_done" | "all";

export default function OwnerInvoicesPage() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("vat_pending");
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
      const res = await fetch(
        `/api/owner/reports/payments?limit=100&offset=${currentOffset}&includeEnrollmentOnly=0`
      );
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
            : "Không thể đánh dấu đã xuất hóa đơn."
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

  const filtered = useMemo(() => {
    return items.filter((row) => {
      if (filter === "all") return true;
      if (filter === "vat_pending") {
        return (
          row.invoice_state === "pending_export" ||
          row.invoice_state === "needs_review"
        );
      }
      if (filter === "vat_done") return row.invoice_state === "exported";
      return true;
    });
  }, [items, filter]);

  const counts = useMemo(() => {
    return {
      pending: items.filter(
        (r) =>
          r.invoice_state === "pending_export" ||
          r.invoice_state === "needs_review"
      ).length,
      done: items.filter((r) => r.invoice_state === "exported").length,
      all: items.length,
    };
  }, [items]);

  const pendingPaymentCount = useMemo(
    () =>
      items.filter((r) => !r.enrollment_only && r.payment_status === "pending")
        .length,
    [items]
  );

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <Link href="/owner" className="text-sm text-gray-400 hover:text-[#D4AF37]">
          ← Dashboard Owner
        </Link>
        <span className="text-gray-600">|</span>
        <Link href="/owner/reports" className="text-sm text-gray-400 hover:text-[#D4AF37]">
          Báo cáo tổng hợp
        </Link>
      </div>

      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Hóa đơn VAT &amp; đối soát
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-gray-400">
        Danh sách giao dịch <strong className="text-gray-300">đã thanh toán</strong> để đối soát với phần mềm kế toán / hệ thống{" "}
        <strong className="text-gray-300">hóa đơn điện tử VAT</strong> của doanh nghiệp. Nút{" "}
        <span className="text-[#D4AF37]">Đánh dấu đã xuất</span> ghi nhận trên hệ thống này sau khi bạn đã phát hành hóa đơn
        ngoài phần mềm (MISA, Viettel, v.v.). Kết nối API tự động với nhà cung cấp hóa đơn có thể bổ sung sau nếu cần.
      </p>

      <p className="mt-3 max-w-3xl text-xs text-gray-500">
        Tab <span className="text-gray-400">«Chờ xuất / cần rà soát»</span> chỉ gồm giao dịch{" "}
        <strong className="text-gray-400">đã thanh toán xong</strong> và chưa đánh dấu xuất hóa đơn (hoặc cần rà soát).
        Giao dịch <strong className="text-gray-400">chờ thanh toán</strong> (pending) nằm ở tab{" "}
        <strong className="text-gray-400">Tất cả giao dịch</strong> hoặc trang{" "}
        <Link href="/owner/reports" className="text-[#D4AF37] underline-offset-2 hover:underline">
          Báo cáo tổng hợp
        </Link>
        .
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            [
              "vat_pending",
              `Chờ xuất / cần rà soát (${counts.pending})`,
              filter === "vat_pending",
            ],
            ["vat_done", `Đã xuất hóa đơn (${counts.done})`, filter === "vat_done"],
            ["all", `Tất cả giao dịch (${counts.all})`, filter === "all"],
          ] as const
        ).map(([key, label, active]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-[#D4AF37] text-black"
                : "border border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {meta && (
        <p className="mt-3 text-xs text-gray-500">
          Đang hiển thị {items.length}/{meta.total} giao dịch (chỉ thanh toán, không gồm đăng ký miễn phí trên trang này).
        </p>
      )}

      <div className="mt-8 rounded-[2rem] border-2 border-[#0a1628] bg-white p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h2 className="text-lg font-bold uppercase tracking-wide text-[#0a1628]">
            Danh sách phục vụ xuất hóa đơn VAT
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
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{loadError}</p>
        )}
        {exportError && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{exportError}</p>
        )}

        {loading ? (
          <p className="mt-6 text-gray-500">Đang tải...</p>
        ) : filtered.length === 0 ? (
          <div className="mt-6 space-y-3 text-gray-500">
            {filter === "vat_pending" ? (
              <>
                <p>
                  {pendingPaymentCount > 0 ? (
                    <>
                      Tab này không liệt kê giao dịch <strong className="text-gray-600">chờ thanh toán</strong> — chỉ
                      các giao dịch đã hoàn tất thanh toán và cần đối soát / đánh dấu xuất VAT. Hiện có{" "}
                      <strong className="text-gray-600">{pendingPaymentCount}</strong> giao dịch pending trong hệ thống:
                      bấm tab <strong className="text-gray-600">Tất cả giao dịch</strong> phía trên để xem, hoặc mở{" "}
                      <Link href="/owner/reports" className="text-[#D4AF37] underline-offset-2 hover:underline">
                        Báo cáo tổng hợp
                      </Link>
                      .
                    </>
                  ) : (
                    <>Không có giao dịch nào cần xuất hoặc rà soát hóa đơn (trong các giao dịch đã thanh toán xong).</>
                  )}
                </p>
              </>
            ) : filter === "vat_done" ? (
              <p>Chưa có giao dịch nào được đánh dấu đã xuất hóa đơn.</p>
            ) : (
              <p>Chưa có dữ liệu giao dịch.</p>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-3 md:hidden">
            {filtered.map((row) => {
              const canMarkExported = row.can_export_invoice;
              const actionLabel =
                canMarkExported && exporting === row.id ? "Đang xử lý..." : row.invoice_action_label;
              const actionTone =
                canMarkExported && exporting !== row.id
                  ? "bg-[#0e5a77] text-white hover:bg-[#0d4d66]"
                  : row.invoice_state === "needs_review"
                    ? "cursor-default bg-amber-100 text-amber-800"
                    : "cursor-default bg-gray-300 text-gray-600";

              return (
                <article
                  key={row.enrollment_only ? `enr:${row.id}` : row.id}
                  className={`rounded-xl border p-4 ${
                    row.orphan_payment
                      ? "border-amber-300 bg-amber-50/90"
                      : "border-black/10 bg-white"
                  }`}
                >
                  <p className="text-sm font-semibold text-[#0a1628]">{row.course_name}</p>
                  <p className="mt-1 text-xs text-gray-600">{row.program_name}</p>
                  <div className="mt-3 space-y-1 text-xs text-[#0a1628]">
                    <p>Học viên: {row.student_name}</p>
                    <p>Mã HV: {row.student_code}</p>
                    <p>Mã giao dịch: {row.management_code}</p>
                    <p>Ngày thanh toán: {row.payment_date_display}</p>
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span>Số tiền: {row.amount_display}</span>
                      {row.is_whitelist ? (
                        <span className="rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6b5a20]">
                          Whitelist
                        </span>
                      ) : null}
                    </p>
                    <p>VAT: {row.invoice_status_label}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleExportInvoice(row.id)}
                    disabled={!canMarkExported || exporting === row.id}
                    title={row.invoice_status_label}
                    className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${actionTone} disabled:cursor-not-allowed disabled:opacity-90`}
                  >
                    {actionLabel}
                  </button>
                </article>
              );
            })}
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
        {!loading && filtered.length > 0 && (
          <div className="mt-6 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[920px] border-collapse">
              <thead>
                <tr className="border-b-2 border-[#0a1628]">
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Chương trình &amp; khóa học
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Học viên / Mã HV
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Mã giao dịch
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Ngày thanh toán
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Số tiền
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-left text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Trạng thái hóa đơn VAT
                  </th>
                  <th className="border border-black/20 px-3 py-3 text-center text-xs font-semibold text-[#0a1628] sm:text-sm">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const canMarkExported = row.can_export_invoice;
                  const invoiceLabel = row.invoice_status_label;
                  const actionLabel =
                    canMarkExported && exporting === row.id
                      ? "Đang xử lý..."
                      : row.invoice_action_label;
                  const actionTone =
                    canMarkExported && exporting !== row.id
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
                      <td className="border border-black/10 px-3 py-3 text-xs text-[#0a1628] sm:text-sm">
                        <div>{row.student_name}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-gray-600">{row.student_code}</div>
                      </td>
                      <td className="border border-black/10 px-3 py-3 font-mono text-[11px] text-[#0a1628] sm:text-sm">
                        {row.management_code}
                      </td>
                      <td className="border border-black/10 px-3 py-3 text-xs text-[#0a1628] sm:text-sm whitespace-nowrap">
                        {row.payment_status === "completed" && row.payment_date_display !== "—"
                          ? row.payment_date_display
                          : row.payment_date_display}
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
                      <td className="border border-black/10 px-3 py-3 text-xs text-[#0a1628] sm:text-sm">
                        {invoiceLabel}
                      </td>
                      <td className="border border-black/10 px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => void handleExportInvoice(row.id)}
                          disabled={!canMarkExported || exporting === row.id}
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
