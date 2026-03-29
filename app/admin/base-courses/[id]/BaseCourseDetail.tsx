"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseBrowserClient } from "../../../../lib/supabase-browser";
import { parsePromotionTiers } from "../../../../lib/promotion-tiers";

type Chapter = {
  id: string;
  sort_order: number;
  name: string;
  objectives: string | null;
  weight_percent: number | null;
  lessons: Array<{
    id: string;
    sort_order: number;
    name: string;
    description: string | null;
    video_url: string | null;
    document_url: string | null;
  }>;
};

type Course = {
  id: string;
  code: string;
  name: string;
  summary: string | null;
  objectives: string | null;
  difficulty_level: string | null;
  prerequisite: string | null;
  final_exam_weight_percent: number | null;
  certificate_pass_percent?: number | null;
  certificate_sample_url?: string | null;
  certificate_template_config?: Record<string, unknown> | null;
  program?: { id: string; name: string };
};

type Props = {
  course: Course;
  chapters: Chapter[];
  isReadOnly?: boolean;
};

export default function BaseCourseDetail({ course, chapters: initialChapters, isReadOnly = false }: Props) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  const [chapters, setChapters] = useState(initialChapters);
  const [addingChapter, setAddingChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  const [newChapterObjectives, setNewChapterObjectives] = useState("");
  const [newChapterWeight, setNewChapterWeight] = useState("");
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [addingLesson, setAddingLesson] = useState<string | null>(null);
  const [newLessonName, setNewLessonName] = useState("");
  const [newLessonDesc, setNewLessonDesc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cloneModal, setCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [clonePriceCents, setClonePriceCents] = useState("");
  const [cloneDiscountPercent, setCloneDiscountPercent] = useState("");
  /** Chỉ một trong hai: % cố định hoặc ưu đãi theo suất */
  const [clonePricingMode, setClonePricingMode] = useState<"flat" | "tiers">("flat");
  /** Đợt có giới hạn suất: số suất + % giảm */
  const [cloneTierCappedRows, setCloneTierCappedRows] = useState<{ slots: string; discount: string }[]>([
    { slots: "", discount: "" },
  ]);
  /** Đợt cuối slots = null */
  const [cloneTierTailDiscount, setCloneTierTailDiscount] = useState("");

  async function handleAddChapter(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const maxOrder = chapters.length ? Math.max(...chapters.map((c) => c.sort_order)) : 0;
      const { data, error: err } = await supabase.from("chapters").insert({
        base_course_id: course.id,
        sort_order: maxOrder + 1,
        name: newChapterName.trim(),
        objectives: newChapterObjectives.trim() || null,
        weight_percent: newChapterWeight ? parseFloat(newChapterWeight) : null,
      }).select().single();

      if (err) throw new Error(err.message);
      setChapters((prev) => [...prev, { ...data, lessons: [] }]);
      setNewChapterName("");
      setNewChapterObjectives("");
      setNewChapterWeight("");
      setAddingChapter(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi thêm chương");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteChapter(chapterId: string) {
    if (!confirm("Xóa chương và toàn bộ bài học bên trong?")) return;
    setLoading(true);
    try {
      const { error: err } = await supabase.from("chapters").delete().eq("id", chapterId);
      if (err) throw new Error(err.message);
      setChapters((prev) => prev.filter((c) => c.id !== chapterId));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi xóa chương");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddLesson(e: FormEvent, chapterId: string) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const ch = chapters.find((c) => c.id === chapterId);
      const maxOrder = ch?.lessons?.length
        ? Math.max(...ch.lessons.map((l) => l.sort_order))
        : 0;
      const { data, error: err } = await supabase.from("lessons").insert({
        chapter_id: chapterId,
        sort_order: maxOrder + 1,
        name: newLessonName.trim(),
        description: newLessonDesc.trim() || null,
      }).select().single();

      if (err) throw new Error(err.message);
      setChapters((prev) =>
        prev.map((c) =>
          c.id === chapterId ? { ...c, lessons: [...(c.lessons ?? []), data] } : c
        )
      );
      setNewLessonName("");
      setNewLessonDesc("");
      setAddingLesson(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi thêm bài học");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteLesson(chapterId: string, lessonId: string) {
    if (!confirm("Xóa bài học này?")) return;
    setLoading(true);
    try {
      const { error: err } = await supabase.from("lessons").delete().eq("id", lessonId);
      if (err) throw new Error(err.message);
      setChapters((prev) =>
        prev.map((c) =>
          c.id === chapterId ? { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) } : c
        )
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi xóa bài học");
    } finally {
      setLoading(false);
    }
  }

  function openCloneModal() {
    setCloneName(`${course.name} (Khóa mới)`);
    setClonePriceCents("");
    setCloneDiscountPercent("");
    setClonePricingMode("flat");
    setCloneTierCappedRows([{ slots: "", discount: "" }]);
    setCloneTierTailDiscount("");
    setCloneModal(true);
    setError("");
  }

  function buildPromotionTiersFromCloneForm(): object {
    const tailTrim = cloneTierTailDiscount.trim();
    const tailD = tailTrim === "" ? 0 : Math.round(parseFloat(cloneTierTailDiscount));
    if (tailTrim !== "" && (!Number.isFinite(tailD) || tailD < 0 || tailD > 99)) {
      throw new Error("Đợt không giới hạn suất: % giảm giá phải là số nguyên 0–99 (để trống = 0%).");
    }

    const capped: { slots: number; discount_percent: number }[] = [];
    for (const r of cloneTierCappedRows) {
      const sTrim = r.slots.trim();
      const dTrim = r.discount.trim();
      if (!sTrim && !dTrim) continue;
      if (!sTrim || !dTrim) {
        throw new Error("Mỗi đợt có giới hạn cần đủ số suất và % giảm giá (hoặc xóa trống cả hai).");
      }
      const slots = Math.round(parseFloat(sTrim));
      const d = Math.round(parseFloat(dTrim));
      if (!Number.isFinite(slots) || slots < 1 || !Number.isInteger(slots)) {
        throw new Error("Số suất mỗi đợt phải là số nguyên ≥ 1.");
      }
      if (!Number.isFinite(d) || d < 0 || d > 99) {
        throw new Error("% giảm giá mỗi đợt phải là số nguyên 0–99.");
      }
      capped.push({ slots, discount_percent: d });
    }

    if (capped.length < 1) {
      throw new Error("Cần ít nhất một đợt có giới hạn suất (số suất + % giảm).");
    }

    const parsed: unknown = [
      ...capped.map((c) => ({ slots: c.slots, discount_percent: c.discount_percent })),
      { slots: null, discount_percent: tailD },
    ];
    if (!parsePromotionTiers(parsed)) {
      throw new Error("Cấu hình đợt ưu đãi không hợp lệ.");
    }
    return parsed as object;
  }

  async function handleCloneToRegular(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const programId = courseWithProgramId.program_id;
      if (!programId) throw new Error("Không tìm thấy chương trình");

      const priceVal = clonePriceCents.trim() ? Math.round(parseFloat(clonePriceCents)) : 0;
      if (priceVal < 0) throw new Error("Giá không hợp lệ");

      const promotion_tiers =
        clonePricingMode === "tiers" ? buildPromotionTiersFromCloneForm() : null;

      const discountVal =
        clonePricingMode === "flat"
          ? cloneDiscountPercent.trim()
            ? Math.min(99, Math.max(0, Math.round(parseFloat(cloneDiscountPercent))))
            : null
          : null;
      if (clonePricingMode === "flat" && discountVal !== null && (discountVal < 0 || discountVal > 99)) {
        throw new Error("Giảm giá cố định phải từ 0–99%.");
      }

      const { data: regularCourse, error: err } = await supabase
        .from("regular_courses")
        .insert({
          base_course_id: course.id,
          program_id: programId,
          name: cloneName.trim() || `${course.name} (Khóa mới)`,
          status: "draft",
          approval_status: "pending",
          price_cents: priceVal,
          discount_percent: discountVal,
          discount_percent_locked: true,
          promotion_tiers,
        })
        .select()
        .single();

      if (err) throw new Error(err.message);
      setCloneModal(false);
      router.push(`/admin/regular-courses/${regularCourse.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tạo khóa thường");
    } finally {
      setLoading(false);
    }
  }

  const courseWithProgramId = course as Course & { program_id?: string };

  const sortedChapters = [...chapters].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const nextChapterDisplayNum = sortedChapters.length + 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
            {course.name}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Mã: {course.code} · Độ khó: {course.difficulty_level || "-"} · Thi cuối: {course.final_exam_weight_percent ?? 30}%
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Chứng chỉ: điểm tổng khóa (quá trình + thi cuối) ≥ {course.certificate_pass_percent ?? 70}%
          </p>
          {course.summary && (
            <p className="mt-3 max-w-2xl text-sm text-gray-300">{course.summary}</p>
          )}
        </div>
        <div className="flex gap-2">
          {isReadOnly && (
            <button
              type="button"
              onClick={openCloneModal}
              disabled={loading}
              className="rounded-full border border-[#D4AF37]/70 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-60"
            >
              Nhân bản
            </button>
          )}
          <Link
            href={`/admin/base-courses/${course.id}/final-exam`}
            className="rounded-full border border-[#D4AF37]/70 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            Bài thi cuối
          </Link>
          {!isReadOnly && (
            <Link
              href={`/admin/base-courses/${course.id}/edit`}
              className="rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-bold text-black hover:bg-[#E7C768]"
            >
              Chỉnh sửa khóa
            </Link>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-base font-semibold text-white">Mẫu chứng chỉ</h2>
        {course.certificate_sample_url ? (
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={course.certificate_sample_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/60 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              <span>📄</span>
              Xem mẫu chứng chỉ
            </a>
            <a
              href={course.certificate_sample_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/60 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              <span>⬇</span>
              Tải mẫu chứng chỉ
            </a>
            <span className="text-sm text-gray-500">(PDF / ảnh mẫu)</span>
            {course.certificate_template_config && Object.keys(course.certificate_template_config).length > 0 && (
              <p className="mt-2 text-xs text-gray-400">
                Đã cấu hình vị trí nhúng (tên, mã, ảnh, ngày cấp, mã chứng chỉ).{" "}
                {!isReadOnly && (
                  <Link href={`/admin/base-courses/${course.id}/edit`} className="text-[#D4AF37] hover:underline">
                    Chỉnh sửa
                  </Link>
                )}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Chưa có mẫu chứng chỉ. {!isReadOnly && (
              <Link href={`/admin/base-courses/${course.id}/edit`} className="text-[#D4AF37] hover:underline">
                Thêm mẫu trong Chỉnh sửa khóa
              </Link>
            )}
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Cấu trúc chương và bài học</h2>

        <div className="space-y-4">
          {sortedChapters.map((ch, chapterIndex) => (
            <div
              key={ch.id}
              className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedChapter(expandedChapter === ch.id ? null : ch.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-[#D4AF37]">
                    CHƯƠNG {chapterIndex + 1}
                  </span>
                  <span className="font-medium text-white">{ch.name}</span>
                  {ch.weight_percent != null && (
                    <span className="text-xs text-gray-400">({ch.weight_percent}%)</span>
                  )}
                </div>
                <span className="text-gray-400">
                  {expandedChapter === ch.id ? "▼" : "▶"} {ch.lessons?.length ?? 0} bài
                </span>
              </button>

              {expandedChapter === ch.id && (
                <div className="border-t border-white/10 px-4 py-3">
                  {ch.lessons?.map((lesson, idx) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 mb-2 last:mb-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">{idx + 1}.</span>
                        <span className="text-sm text-white">{lesson.name}</span>
                        {lesson.video_url && (
                          <span className="rounded bg-[#D4AF37]/20 px-1.5 py-0.5 text-xs text-[#D4AF37]">
                            Video
                          </span>
                        )}
                        {lesson.document_url && (
                          <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-xs text-blue-300">
                            PDF
                          </span>
                        )}
                      </div>
                      {!isReadOnly && (
                        <div className="flex gap-2">
                          <Link
                            href={`/admin/lessons/${lesson.id}`}
                            className="text-xs text-[#D4AF37] hover:underline"
                          >
                            Sửa
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteLesson(ch.id, lesson.id)}
                            disabled={loading}
                            className="text-xs text-red-400 hover:underline disabled:opacity-60"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {!isReadOnly && addingLesson === ch.id ? (
                    <form onSubmit={(e) => handleAddLesson(e, ch.id)} className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={newLessonName}
                        onChange={(e) => setNewLessonName(e.target.value)}
                        placeholder="Tên bài học"
                        className="w-full rounded-lg border border-white/15 bg-[#0b1323] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]"
                        required
                      />
                      <input
                        type="text"
                        value={newLessonDesc}
                        onChange={(e) => setNewLessonDesc(e.target.value)}
                        placeholder="Mô tả (tùy chọn)"
                        className="w-full rounded-lg border border-white/15 bg-[#0b1323] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                        >
                          Thêm
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingLesson(null);
                            setNewLessonName("");
                            setNewLessonDesc("");
                          }}
                          className="rounded-lg border border-white/20 px-4 py-2 text-sm text-gray-300"
                        >
                          Hủy
                        </button>
                      </div>
                    </form>
                  ) : !isReadOnly ? (
                    <button
                      type="button"
                      onClick={() => setAddingLesson(ch.id)}
                      className="mt-3 text-sm text-[#D4AF37] hover:underline"
                    >
                      + Thêm bài học
                    </button>
                  ) : null}

                  {!isReadOnly && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteChapter(ch.id)}
                        disabled={loading}
                        className="text-sm text-red-400 hover:underline disabled:opacity-60"
                      >
                        Xóa chương
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {!isReadOnly && addingChapter ? (
            <form onSubmit={handleAddChapter} className="rounded-xl border border-[#D4AF37]/30 bg-[#0b1323] p-4">
              <h3 className="mb-1 font-medium text-[#D4AF37]">Thêm chương mới</h3>
              <p className="mb-3 text-xs text-gray-500">
                Thứ tự hiển thị:{" "}
                <span className="font-semibold text-[#D4AF37]">CHƯƠNG {nextChapterDisplayNum}</span>
                {" "}
                (tự động từ CHƯƠNG 1 theo thứ tự thêm; chỉ cần nhập tên nội dung chương)
              </p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={newChapterName}
                  onChange={(e) => setNewChapterName(e.target.value)}
                  placeholder="Tên chương (VD: Giới thiệu, Phạm vi áp dụng...) *"
                  className="w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white outline-none focus:border-[#D4AF37]"
                  required
                />
                <textarea
                  value={newChapterObjectives}
                  onChange={(e) => setNewChapterObjectives(e.target.value)}
                  placeholder="Mục tiêu chương (tùy chọn)"
                  className="w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]"
                  rows={2}
                />
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={newChapterWeight}
                  onChange={(e) => setNewChapterWeight(e.target.value)}
                  placeholder="% điểm (tùy chọn)"
                  className="w-full rounded-lg border border-white/15 bg-[#0a1628] px-3 py-2 text-white outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Thêm chương
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingChapter(false);
                    setNewChapterName("");
                    setNewChapterObjectives("");
                    setNewChapterWeight("");
                  }}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm text-gray-300"
                >
                  Hủy
                </button>
              </div>
            </form>
          ) : !isReadOnly ? (
            <button
              type="button"
              onClick={() => setAddingChapter(true)}
              className="flex w-full items-center justify-center rounded-xl border-2 border-dashed border-[#D4AF37]/40 py-6 text-[#D4AF37] hover:border-[#D4AF37]/70 hover:bg-[#D4AF37]/5"
            >
              + Thêm chương
            </button>
          ) : null}
        </div>
      </div>

      {cloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleCloneToRegular}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#0a1628] p-6 shadow-xl"
          >
            <h3 className="text-lg font-semibold text-[#D4AF37]">Nhân bản khóa học thường</h3>
            <p className="mt-2 text-sm text-gray-400">
              Tạo phiên khóa học mới từ <strong className="text-white">{course.name}</strong>
            </p>
            <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
              Khóa tạo ra sẽ ở trạng thái <strong className="font-semibold">chờ Owner phê duyệt</strong> — chưa hiển thị trên
              trang chủ/catalog cho đến khi Owner duyệt tại mục &quot;Phê duyệt khóa học thường&quot;.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-white/90">Tên khóa *</label>
                <input
                  type="text"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-[#0b1323] px-3 py-2 text-white outline-none focus:border-[#D4AF37]"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-white/90">Giá (VNĐ)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={clonePriceCents}
                  onChange={(e) => setClonePriceCents(e.target.value)}
                  placeholder="VD: 990000"
                  className="w-full rounded-lg border border-white/15 bg-[#0b1323] px-3 py-2 text-white outline-none focus:border-[#D4AF37]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-white/90">Cách áp dụng giá / ưu đãi</label>
                <select
                  value={clonePricingMode}
                  onChange={(e) => setClonePricingMode(e.target.value as "flat" | "tiers")}
                  className="w-full rounded-lg border border-white/15 bg-[#0b1323] px-3 py-2 text-white outline-none focus:border-[#D4AF37]"
                >
                  <option value="flat">Giảm giá cố định (%)</option>
                  <option value="tiers">Ưu đãi theo suất</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Chọn một: hoặc một mức % cố định, hoặc các đợt theo số suất (và đợt cuối không giới hạn suất). Không dùng song song hai cách khi tạo khóa.
                </p>
              </div>
              {clonePricingMode === "flat" ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-white/90">Giảm giá cố định (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={cloneDiscountPercent}
                    onChange={(e) => setCloneDiscountPercent(e.target.value)}
                    placeholder="VD: 10 (để trống = không giảm)"
                    className="w-full rounded-lg border border-white/15 bg-[#0b1323] px-3 py-2 text-white outline-none focus:border-[#D4AF37]"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    0–99%. Để trống = không giảm. Sau khi tạo, % này được{" "}
                    <strong className="font-medium text-gray-400">khóa</strong> — không sửa trên màn chỉnh sửa (tránh lệch giá thanh toán). Có thể chuyển sang ưu đãi theo suất sau trên màn sửa khóa.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-white/10 bg-[#0b1323]/50 p-3">
                  <label className="mb-2 block text-sm font-medium text-white/90">Ưu đãi theo suất</label>
                  <p className="mb-3 text-xs text-gray-500">
                    Thêm từng đợt có giới hạn suất, rồi mức % cho đợt không giới hạn suất (sau các đợt trước). Đợt cuối để trống = 0% (giá gốc sau các đợt có suất).
                  </p>
                  <div className="space-y-3">
                    {cloneTierCappedRows.map((row, idx) => (
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
                              setCloneTierCappedRows((prev) =>
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
                              setCloneTierCappedRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, discount: v } : r))
                              );
                            }}
                            placeholder="VD: 30"
                            className="w-full rounded-md border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white outline-none focus:border-[#D4AF37]"
                          />
                        </div>
                        {cloneTierCappedRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setCloneTierCappedRows((prev) => prev.filter((_, i) => i !== idx))
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
                        setCloneTierCappedRows((prev) => [...prev, { slots: "", discount: "" }])
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
                          value={cloneTierTailDiscount}
                          onChange={(e) => setCloneTierTailDiscount(e.target.value)}
                          placeholder="Trống = 0%"
                          className="w-full rounded-md border border-white/15 bg-[#0b1323] px-2 py-1.5 text-sm text-white outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {error && (
              <p className="mt-3 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setClonePricingMode("flat");
                  setCloneTierCappedRows([{ slots: "", discount: "" }]);
                  setCloneTierTailDiscount("");
                  setCloneModal(false);
                }}
                className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-bold text-black hover:bg-[#E7C768] disabled:opacity-60"
              >
                {loading ? "Đang tạo..." : "Tạo khóa học thường"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
