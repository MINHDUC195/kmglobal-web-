"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { AdminBreadcrumbStrip } from "../../../../../components/AdminHierarchyBreadcrumb";
import { getSupabaseBrowserClient } from "../../../../../lib/supabase-browser";

type CertConfig = {
  fullName?: { x?: number; y?: number; fontSize?: number; fontFamily?: string };
  studentCode?: { x?: number; y?: number; fontSize?: number; fontFamily?: string };
  avatar?: { x?: number; y?: number; width?: number; height?: number };
  issueDate?: { x?: number; y?: number; fontSize?: number; fontFamily?: string };
  certificateCode?: { x?: number; y?: number; fontSize?: number; fontFamily?: string };
};

const PDF_FONTS: { value: string; label: string }[] = [
  { value: "Helvetica", label: "Helvetica" },
  { value: "Helvetica-Bold", label: "Helvetica Bold" },
  { value: "Times-Roman", label: "Times Roman" },
  { value: "Times-Bold", label: "Times Bold" },
  { value: "Times-Italic", label: "Times Italic" },
  { value: "Times-BoldItalic", label: "Times Bold Italic" },
  { value: "Courier", label: "Courier" },
  { value: "Courier-Bold", label: "Courier Bold" },
];

const DEFAULT_CONFIG: CertConfig = {
  fullName: { x: 150, y: 380, fontSize: 14, fontFamily: "Helvetica-Bold" },
  studentCode: { x: 150, y: 350, fontSize: 12, fontFamily: "Helvetica" },
  avatar: { x: 60, y: 320, width: 70, height: 90 },
  issueDate: { x: 150, y: 300, fontSize: 11, fontFamily: "Helvetica" },
  certificateCode: { x: 150, y: 260, fontSize: 10, fontFamily: "Helvetica" },
};

function parseNum(v: unknown): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

export default function EditBaseCoursePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = getSupabaseBrowserClient();

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [objectives, setObjectives] = useState("");
  const [difficultyLevel, setDifficultyLevel] = useState("");
  const [prerequisite, setPrerequisite] = useState("");
  const [finalExamWeight, setFinalExamWeight] = useState("");
  const [certificatePassPercent, setCertificatePassPercent] = useState("");
  const [certificateSampleUrl, setCertificateSampleUrl] = useState("");
  const [certConfig, setCertConfig] = useState<CertConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pdfPreviewError, setPdfPreviewError] = useState("");
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false);
  const [programId, setProgramId] = useState<string | null>(null);
  const [programName, setProgramName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase
        .from("base_courses")
        .select("*, program:programs(id, name, approval_status)")
        .eq("id", id)
        .single();
      if (err || !data) {
        if (err?.message?.includes("certificate_sample_url") || err?.message?.includes("schema cache")) {
          setError("Chưa chạy migration. Vào Supabase Dashboard → SQL Editor → chạy file supabase/ops/RUN_MIGRATION_CERTIFICATE_SAMPLE.sql rồi tải lại trang.");
        } else {
          setError(err?.message || "Không tìm thấy khóa học");
        }
        return;
      }
      const prog = data.program as { id?: string; name?: string; approval_status?: string } | null;
      if (prog?.approval_status === "approved") {
        router.replace(`/admin/base-courses/${id}`);
        return;
      }
      if (prog?.id) {
        setProgramId(prog.id);
        setProgramName(prog.name?.trim() || "");
      }
      setCode(data.code ?? "");
      setName(data.name ?? "");
      setSummary(data.summary ?? "");
      setObjectives(data.objectives ?? "");
      setDifficultyLevel(data.difficulty_level ?? "");
      setPrerequisite(data.prerequisite ?? "");
      setFinalExamWeight(String(data.final_exam_weight_percent ?? 30));
      setCertificatePassPercent(
        data.certificate_pass_percent != null && data.certificate_pass_percent !== ""
          ? String(data.certificate_pass_percent)
          : "70"
      );
      setCertificateSampleUrl(data.certificate_sample_url ?? "");
      const raw = data.certificate_template_config as CertConfig | null | undefined;
      if (raw && typeof raw === "object") {
        setCertConfig({
          fullName: { ...DEFAULT_CONFIG.fullName, ...raw.fullName },
          studentCode: { ...DEFAULT_CONFIG.studentCode, ...raw.studentCode },
          avatar: { ...DEFAULT_CONFIG.avatar, ...raw.avatar },
          issueDate: { ...DEFAULT_CONFIG.issueDate, ...raw.issueDate },
          certificateCode: { ...DEFAULT_CONFIG.certificateCode, ...raw.certificateCode },
        });
      }
    }
    void load().finally(() => setLoading(false));
  }, [id, supabase, router]);

  async function handleCertificatePdfPreview() {
    if (!certificateSampleUrl.trim()) {
      setPdfPreviewError("Cần có mẫu chứng chỉ (PDF/ảnh). Hãy tải lên trước.");
      return;
    }
    setPdfPreviewError("");
    setPreviewPdfLoading(true);
    try {
      const res = await fetch(`/api/admin/base-courses/${id}/certificate-preview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          certificate_template_config: certConfig,
          certificate_sample_url: certificateSampleUrl.trim(),
        }),
      });
      const contentType = res.headers.get("content-type") || "";

      if (!res.ok) {
        const errText = await res.text();
        let msg = "Không tạo được PDF thử";
        try {
          const j = JSON.parse(errText) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          if (errText) msg = errText;
        }
        throw new Error(msg);
      }

      if (!contentType.includes("application/pdf")) {
        const errText = await res.text();
        let msg = "Phản hồi không phải PDF (có thể lỗi máy chủ hoặc phiên đăng nhập).";
        try {
          const j = JSON.parse(errText) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          if (errText) msg = errText.slice(0, 500);
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) {
        const a = document.createElement("a");
        a.href = url;
        a.download = "certificate-preview.pdf";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (err) {
      setPdfPreviewError(err instanceof Error ? err.message : "Lỗi tạo PDF thử");
    } finally {
      setPreviewPdfLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/base-courses/${id}/certificate-sample`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi tải lên");
      setCertificateSampleUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải lên");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { error: err } = await supabase
        .from("base_courses")
        .update({
          code: code.trim(),
          name: name.trim(),
          summary: summary.trim() || null,
          objectives: objectives.trim() || null,
          difficulty_level: difficultyLevel.trim() || null,
          prerequisite: prerequisite.trim() || null,
          final_exam_weight_percent: finalExamWeight ? parseFloat(finalExamWeight) : 30,
          certificate_pass_percent: certificatePassPercent ? parseFloat(certificatePassPercent) : 70,
          certificate_require_all_lessons_completed: false,
          certificate_sample_url: certificateSampleUrl.trim() || null,
          certificate_template_config: certConfig,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (err) throw new Error(err.message);
      router.push(`/admin/base-courses/${id}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lỗi cập nhật";
      if (
        msg.includes("certificate_sample_url") ||
        msg.includes("certificate_template_config") ||
        msg.includes("certificate_require_all_lessons_completed") ||
        msg.includes("schema cache")
      ) {
        setError(
          "Chưa chạy migration. Vào Supabase Dashboard → SQL Editor → chạy các file supabase/ops/RUN_MIGRATION_CERTIFICATE_SAMPLE.sql và supabase/ops/RUN_MIGRATION_CERTIFICATE_REQUIRE_LESSONS.sql (và supabase/ops/RUN_MIGRATION_CERTIFICATE_PASS.sql nếu cần) rồi tải lại trang."
        );
      } else {
        setError(msg);
      }
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

  if (error && !code) {
    return (
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-red-400">{error}</p>
          <Link href="/admin/programs" className="mt-4 inline-block text-[#D4AF37] hover:underline">
            ← Về danh sách
          </Link>
        </main>
    );
  }

  const editBaseBreadcrumb = [
    { label: "Chương trình", href: "/admin/programs" },
    ...(programId
      ? [{ label: programName || "Chương trình", href: `/admin/programs/${programId}` }]
      : []),
    { label: name || "Khóa học cơ bản", href: `/admin/base-courses/${id}` },
    { label: "Chỉnh sửa khóa học" },
  ];

  return (
    <>
      <AdminBreadcrumbStrip items={editBaseBreadcrumb} />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Chỉnh sửa khóa học cơ bản
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 max-w-3xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Mã khóa học *</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
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
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Tóm tắt</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Mục tiêu khóa học</label>
            <textarea
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
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
            <label className="mb-1 block text-sm font-medium text-white/90">Điều kiện tiên quyết</label>
            <textarea
              value={prerequisite}
              onChange={(e) => setPrerequisite(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">% Điểm thi cuối khóa</label>
            <input
              type="number"
              min="0"
              max="100"
              step="5"
              value={finalExamWeight}
              onChange={(e) => setFinalExamWeight(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            />
            <p className="mt-1 text-xs text-gray-500">Trọng số điểm bài thi cuối trong tổng điểm khóa học.</p>
          </div>

          <div className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/5 p-4">
            <h2 className="mb-3 text-sm font-semibold text-[#D4AF37]">Điều kiện cấp chứng chỉ hoàn thành</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/90">
                Ngưỡng điểm tổng khóa học (%) để cấp chứng chỉ
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={certificatePassPercent}
                onChange={(e) => setCertificatePassPercent(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              />
              <p className="mt-1 text-xs text-gray-500">
                Điểm tổng = phần quá trình (bài học / quiz trong khóa) + phần bài thi cuối khóa, theo trọng số đã cấu hình
                ở mục &quot;% Điểm thi cuối khóa&quot; phía trên. Học viên đạt chứng chỉ khi điểm tổng ≥ ngưỡng này (mặc
                định 70%).
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Mẫu chứng chỉ (PDF / ảnh)</label>
            <div className="flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/60 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-60"
              >
                <span>⬆</span>
                {uploading ? "Đang tải lên..." : "Tải lên PDF/ảnh"}
              </button>
            </div>
            {certificateSampleUrl.trim() ? (
              <p className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400">
                Đã có mẫu trên hệ thống. Có thể tải file mới để thay thế.
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500">
              Chỉ tải file từ máy. Mẫu sẽ hiển thị tại trang chi tiết khóa.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Chứng chỉ — vị trí trên mẫu (tọa độ PDF)</h3>
                <p className="mt-1 max-w-xl text-xs text-gray-500">
                  Đơn vị: <strong className="font-medium text-gray-400">point</strong> (1 pt ≈ 1/72 inch). Hệ tọa độ PDF:
                  gốc (0,0) ở góc dưới-trái trang; trang A4 ngang thường ~842×595. Nhập số bên dưới rồi bấm «Xem PDF thử»
                  để kiểm tra — đó là cùng engine với chứng chỉ thật.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleCertificatePdfPreview()}
                disabled={previewPdfLoading || !certificateSampleUrl.trim()}
                className="shrink-0 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {previewPdfLoading ? "Đang tạo PDF thử..." : "Xem PDF thử (chuẩn in)"}
              </button>
            </div>
            {pdfPreviewError ? (
              <p className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {pdfPreviewError}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-white/5 p-3">
                <p className="text-xs font-medium text-[#D4AF37]">Tên học viên</p>
                <div className="flex flex-wrap gap-2">
                  <input type="number" placeholder="x" value={certConfig.fullName?.x ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, fullName: { ...c.fullName, x: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="y" value={certConfig.fullName?.y ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, fullName: { ...c.fullName, y: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="cỡ" value={certConfig.fullName?.fontSize ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, fullName: { ...c.fullName, fontSize: parseNum(e.target.value) } }))} className="w-14 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" title="cỡ chữ" />
                  <select value={certConfig.fullName?.fontFamily ?? "Helvetica-Bold"} onChange={(e) => setCertConfig((c) => ({ ...c, fullName: { ...c.fullName, fontFamily: e.target.value } }))} className="rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white">
                    {PDF_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-white/5 p-3">
                <p className="text-xs font-medium text-[#D4AF37]">Mã học viên</p>
                <div className="flex flex-wrap gap-2">
                  <input type="number" placeholder="x" value={certConfig.studentCode?.x ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, studentCode: { ...c.studentCode, x: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="y" value={certConfig.studentCode?.y ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, studentCode: { ...c.studentCode, y: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="cỡ" value={certConfig.studentCode?.fontSize ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, studentCode: { ...c.studentCode, fontSize: parseNum(e.target.value) } }))} className="w-14 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <select value={certConfig.studentCode?.fontFamily ?? "Helvetica"} onChange={(e) => setCertConfig((c) => ({ ...c, studentCode: { ...c.studentCode, fontFamily: e.target.value } }))} className="rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white">
                    {PDF_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-white/5 p-3 sm:col-span-2">
                <p className="text-xs font-medium text-[#D4AF37]">Ảnh (để trống nếu học viên không có ảnh)</p>
                <div className="flex flex-wrap gap-2">
                  <input type="number" placeholder="x" value={certConfig.avatar?.x ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, avatar: { ...c.avatar, x: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="y" value={certConfig.avatar?.y ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, avatar: { ...c.avatar, y: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="rộng" value={certConfig.avatar?.width ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, avatar: { ...c.avatar, width: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="cao" value={certConfig.avatar?.height ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, avatar: { ...c.avatar, height: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-white/5 p-3">
                <p className="text-xs font-medium text-[#D4AF37]">Ngày cấp</p>
                <div className="flex flex-wrap gap-2">
                  <input type="number" placeholder="x" value={certConfig.issueDate?.x ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, issueDate: { ...c.issueDate, x: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="y" value={certConfig.issueDate?.y ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, issueDate: { ...c.issueDate, y: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="cỡ" value={certConfig.issueDate?.fontSize ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, issueDate: { ...c.issueDate, fontSize: parseNum(e.target.value) } }))} className="w-14 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <select value={certConfig.issueDate?.fontFamily ?? "Helvetica"} onChange={(e) => setCertConfig((c) => ({ ...c, issueDate: { ...c.issueDate, fontFamily: e.target.value } }))} className="rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white">
                    {PDF_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2 rounded-lg border border-white/5 p-3">
                <p className="text-xs font-medium text-[#D4AF37]">Mã chứng chỉ</p>
                <div className="flex flex-wrap gap-2">
                  <input type="number" placeholder="x" value={certConfig.certificateCode?.x ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, certificateCode: { ...c.certificateCode, x: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="y" value={certConfig.certificateCode?.y ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, certificateCode: { ...c.certificateCode, y: parseNum(e.target.value) } }))} className="w-20 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <input type="number" placeholder="cỡ" value={certConfig.certificateCode?.fontSize ?? ""} onChange={(e) => setCertConfig((c) => ({ ...c, certificateCode: { ...c.certificateCode, fontSize: parseNum(e.target.value) } }))} className="w-14 rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white" />
                  <select value={certConfig.certificateCode?.fontFamily ?? "Helvetica"} onChange={(e) => setCertConfig((c) => ({ ...c, certificateCode: { ...c.certificateCode, fontFamily: e.target.value } }))} className="rounded border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white">
                    {PDF_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
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
              href={`/admin/base-courses/${id}`}
              className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
            >
              Hủy
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}
