"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AdminBreadcrumbStrip } from "../../../../../../components/AdminHierarchyBreadcrumb";
import DashboardNav from "../../../../../../components/DashboardNav";
import Footer from "../../../../../../components/Footer";
import { getSupabaseBrowserClient } from "../../../../../../lib/supabase-browser";

export default function NewBaseCoursePage() {
  const router = useRouter();
  const params = useParams();
  const programId = params.id as string;
  const supabase = getSupabaseBrowserClient();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [objectives, setObjectives] = useState("");
  const [difficultyLevel, setDifficultyLevel] = useState("");
  const [prerequisite, setPrerequisite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [programName, setProgramName] = useState("");

  useEffect(() => {
    async function check() {
      const { data } = await supabase
        .from("programs")
        .select("approval_status, name")
        .eq("id", programId)
        .single();
      if ((data as { approval_status?: string })?.approval_status === "approved") {
        router.replace(`/admin/programs/${programId}`);
      }
      setProgramName((data as { name?: string })?.name?.trim() || "");
      setLoading(false);
    }
    void check();
  }, [programId, router, supabase]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const { error: err } = await supabase.from("base_courses").insert({
        program_id: programId,
        code: code.trim(),
        name: name.trim(),
        summary: summary.trim() || null,
        objectives: objectives.trim() || null,
        difficulty_level: difficultyLevel.trim() || null,
        prerequisite: prerequisite.trim() || null,
      });

      if (err) {
        setError(err.message);
        return;
      }

      router.push(`/admin/programs/${programId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Admin" />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-gray-400">Đang tải...</p>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Admin" />
      <AdminBreadcrumbStrip
        items={[
          { label: "Chương trình", href: "/admin/programs" },
          { label: programName || "Chương trình", href: `/admin/programs/${programId}` },
          { label: "Thêm khóa học cơ bản" },
        ]}
      />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Thêm khóa học cơ bản
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Mã khóa học *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              placeholder="VD: ISO9001-01"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Tên khóa học *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              placeholder="VD: ISO 9001:2015 - Cơ bản"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Tóm tắt nội dung và mục tiêu</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              placeholder="Mô tả ngắn gọn"
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Mục tiêu khóa học</label>
            <textarea
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              placeholder="Sau khóa học, học viên có thể..."
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Cấp độ khó</label>
            <select
              value={difficultyLevel}
              onChange={(e) => setDifficultyLevel(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            >
              <option value="">Chọn</option>
              <option value="beginner">Cơ bản</option>
              <option value="intermediate">Trung cấp</option>
              <option value="advanced">Nâng cao</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Điều kiện năng lực tiên quyết</label>
            <textarea
              value={prerequisite}
              onChange={(e) => setPrerequisite(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              placeholder="Yêu cầu trước khi học"
              rows={2}
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
              href={`/admin/programs/${programId}`}
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
