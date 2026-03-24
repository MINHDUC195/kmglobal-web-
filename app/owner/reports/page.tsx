"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PaymentItem = {
  id: string;
  course_name: string;
  management_code: string;
  student_name: string;
  student_code: string;
  status: string;
  amount_cents: number;
  amount_display: string;
  invoice_exported_at: string | null;
};

export default function OwnerReportsPage() {
  const [items, setItems] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/reports/payments");
      const data = await res.json();
      if (res.ok) setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportInvoice(id: string) {
    if (exporting) return;
    setExporting(id);
    try {
      const res = await fetch(`/api/owner/reports/payments/${id}/export-invoice`, {
        method: "POST",
      });
      if (res.ok) void loadPayments();
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

        {loading ? (
          <p className="mt-6 text-gray-500">Đang tải...</p>
        ) : items.length === 0 ? (
          <p className="mt-6 text-gray-500">Chưa có giao dịch thanh toán nào.</p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b-2 border-[#0a1628]">
                  <th className="border border-black/20 px-4 py-3 text-left text-sm font-semibold text-[#0a1628]">
                    Khóa học
                  </th>
                  <th className="border border-black/20 px-4 py-3 text-left text-sm font-semibold text-[#0a1628]">
                    Mã quản lý
                  </th>
                  <th className="border border-black/20 px-4 py-3 text-left text-sm font-semibold text-[#0a1628]">
                    Tên học viên
                  </th>
                  <th className="border border-black/20 px-4 py-3 text-left text-sm font-semibold text-[#0a1628]">
                    Mã học viên
                  </th>
                  <th className="border border-black/20 px-4 py-3 text-left text-sm font-semibold text-[#0a1628]">
                    Trạng thái
                    <span className="mt-1 block text-xs font-normal text-gray-600">
                      (Đã đăng ký / Đã thanh toán)
                    </span>
                  </th>
                  <th className="border border-black/20 px-4 py-3 text-left text-sm font-semibold text-[#0a1628]">
                    Số tiền
                  </th>
                  <th className="border border-black/20 px-4 py-3 text-center text-sm font-semibold text-[#0a1628]">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-black/10">
                    <td className="border border-black/10 px-4 py-3 text-sm text-[#0a1628]">
                      {row.course_name}
                    </td>
                    <td className="border border-black/10 px-4 py-3 text-sm text-[#0a1628]">
                      {row.management_code}
                    </td>
                    <td className="border border-black/10 px-4 py-3 text-sm text-[#0a1628]">
                      {row.student_name}
                    </td>
                    <td className="border border-black/10 px-4 py-3 text-sm text-[#0a1628]">
                      {row.student_code}
                    </td>
                    <td className="border border-black/10 px-4 py-3 text-sm text-[#0a1628]">
                      {row.status}
                    </td>
                    <td className="border border-black/10 px-4 py-3 text-sm text-[#0a1628]">
                      {row.amount_display}
                    </td>
                    <td className="border border-black/10 px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleExportInvoice(row.id)}
                        disabled={!!row.invoice_exported_at || exporting === row.id}
                        className={`
                          rounded-lg px-4 py-2 text-sm font-medium
                          ${row.invoice_exported_at
                            ? "bg-gray-300 text-gray-600 cursor-default"
                            : "bg-[#0e5a77] text-white hover:bg-[#0d4d66]"
                          }
                          disabled:opacity-70 disabled:cursor-not-allowed
                        `}
                      >
                        {row.invoice_exported_at ? "Đã xuất" : exporting === row.id ? "Đang xử lý..." : "Xuất hóa đơn"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
