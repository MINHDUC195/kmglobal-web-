"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
  /** Dòng từ đăng ký không qua cổng thanh toán (không có payment) */
  enrollment_only?: boolean;
};

export default function OwnerReportsPage() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
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
    if (!row || row.payment_status !== "completed" || row.invoice_exported_at) return;

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
            : "Không thể xuất hóa đơn."
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

  return (
    <>
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/owner"
          className="text-sm text-gray-400 hover:text-[#D4AF37]"
        >
          ← Dashboard Owner
        </Link>
      </div>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Báo cáo
      </h1>

      <div className="mt-8 rounded-[2rem] border-2 border-[#0a1628] bg-white p-8">
        <h2 className="text-lg font-bold uppercase tracking-wide text-[#0a1628]">
          Thông tin thanh toán
        </h2>

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
                  const pay = row.payment_status || "";
                  const enrollmentOnly = Boolean(row.enrollment_only);
                  const canExportInvoice =
                    !enrollmentOnly &&
                    pay === "completed" &&
                    !row.invoice_exported_at;
                  let actionLabel: string;
                  if (enrollmentOnly && pay === "free") {
                    actionLabel = "—";
                  } else if (row.invoice_exported_at) {
                    actionLabel = "Đã xuất";
                  } else if (canExportInvoice) {
                    actionLabel = exporting === row.id ? "Đang xử lý..." : "Xuất hóa đơn";
                  } else if (pay === "pending") {
                    actionLabel = "Chưa thanh toán";
                  } else {
                    actionLabel = "Không thể xuất";
                  }
                  return (
                    <tr
                      key={enrollmentOnly ? `enr:${row.id}` : row.id}
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
                        {row.amount_display}
                      </td>
                      <td className="border border-black/10 px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => void handleExportInvoice(row.id)}
                          disabled={!canExportInvoice || exporting === row.id}
                          className={`
                          rounded-lg px-3 py-2 text-xs font-medium sm:text-sm
                          ${canExportInvoice && exporting !== row.id
                            ? "bg-[#0e5a77] text-white hover:bg-[#0d4d66]"
                            : "cursor-default bg-gray-300 text-gray-600"
                          }
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
