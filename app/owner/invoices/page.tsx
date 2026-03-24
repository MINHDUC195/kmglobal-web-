"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
};

type FilterKey = "vat_pending" | "vat_done" | "all";

export default function OwnerInvoicesPage() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("vat_pending");
  const loadInFlight = useRef(false);

  async function loadPayments() {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/owner/reports/payments");
      const data = await res.json();
      if (res.ok) {
        const raw = (data.items ?? []) as PaymentItem[];
        const seen = new Set<string>();
        setItems(
          raw.filter((row) => {
            if (seen.has(row.id)) return false;
            seen.add(row.id);
            return true;
          })
        );
      } else {
        setLoadError((data as { error?: string }).error ?? "Không tải được danh sách.");
        setItems([]);
      }
    } catch {
      setLoadError("Lỗi kết nối.");
      setItems([]);
    } finally {
      setLoading(false);
      loadInFlight.current = false;
    }
  }

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
        await loadPayments();
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

  useEffect(() => {
    void loadPayments();
  }, []);

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

      <div className="mt-6 flex flex-wrap gap-2">
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

      <div className="mt-8 rounded-[2rem] border-2 border-[#0a1628] bg-white p-8">
        <h2 className="text-lg font-bold uppercase tracking-wide text-[#0a1628]">
          Danh sách phục vụ xuất hóa đơn VAT
        </h2>

        {loadError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{loadError}</p>
        )}
        {exportError && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{exportError}</p>
        )}

        {loading ? (
          <p className="mt-6 text-gray-500">Đang tải...</p>
        ) : filtered.length === 0 ? (
          <p className="mt-6 text-gray-500">
            {filter === "vat_pending"
              ? "Không có giao dịch nào cần xuất hoặc rà soát hóa đơn."
              : filter === "vat_done"
                ? "Chưa có giao dịch nào được đánh dấu đã xuất hóa đơn."
                : "Chưa có dữ liệu giao dịch."}
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
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
                      className="border-b border-black/10"
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
                        {row.amount_display}
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
          </div>
        )}
      </div>
    </>
  );
}
