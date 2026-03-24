"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AdminBreadcrumbStrip } from "../../../../components/AdminHierarchyBreadcrumb";
import DashboardNav from "../../../../components/DashboardNav";
import Footer from "../../../../components/Footer";
import { getSupabaseBrowserClient } from "../../../../lib/supabase-browser";

export default function NewProgramPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const { error: err } = await supabase.from("programs").insert({
        name: name.trim(),
        code: code.trim() || null,
        note: note.trim() || null,
      });

      if (err) {
        setError(err.message);
        return;
      }

      router.push("/admin/programs");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Admin" />
      <AdminBreadcrumbStrip
        items={[
          { label: "Chương trình", href: "/admin/programs" },
          { label: "Thêm chương trình học" },
        ]}
      />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Thêm chương trình học
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Tên chương trình *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              placeholder="VD: ISO 9001:2015"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Mã quản lý</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              placeholder="VD: ISO9001"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Ghi chú</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              placeholder="Ghi chú nội bộ"
              rows={3}
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
              disabled={isSubmitting}
              className="rounded-full bg-[#D4AF37] px-6 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-60"
            >
              {isSubmitting ? "Đang lưu..." : "Thêm vào"}
            </button>
            <Link
              href="/admin/programs"
              className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
            >
              Hủy
            </Link>
          </div>
        </form>
      </main>

      <Footer hideLogo />
    </div>
  );
}
