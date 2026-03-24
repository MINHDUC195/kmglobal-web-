"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import BunnyVideoPlayer from "../../../../components/BunnyVideoPlayer";
import { AdminBreadcrumbStrip } from "../../../../components/AdminHierarchyBreadcrumb";
import DashboardNav from "../../../../components/DashboardNav";
import Footer from "../../../../components/Footer";
import PDFViewer from "../../../../components/PDFViewer";
import { acquireLock, extendLock, releaseLock } from "../../../../lib/edit-lock";
import { getSupabaseBrowserClient } from "../../../../lib/supabase-browser";

const HEARTBEAT_MS = 5 * 60 * 1000; // 5 phút

function formatExpiresAt(iso: string): string {
  try {
    const d = new Date(iso);
    const mins = Math.max(0, Math.round((d.getTime() - Date.now()) / 60000));
    if (mins <= 0) return "sắp hết hạn";
    return `khoảng ${mins} phút nữa`;
  } catch {
    return "";
  }
}

export default function EditLessonPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = getSupabaseBrowserClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [baseCourseId, setBaseCourseId] = useState("");
  const [baseCourseName, setBaseCourseName] = useState("");
  const [programId, setProgramId] = useState<string | null>(null);
  const [programName, setProgramName] = useState("");
  const [lessonQuestions, setLessonQuestions] = useState<{ id: string; code?: string | null; content: string; type: string }[]>([]);
  const [libraryQuestions, setLibraryQuestions] = useState<{ id: string; code?: string | null; content: string; type: string }[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lockError, setLockError] = useState<{ lockedBy: string; expiresAt: string } | null>(null);
  const [hasLock, setHasLock] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function load() {
      const { data: lesson, error: errLesson } = await supabase
        .from("lessons")
        .select(`
          *,
          chapter:chapters(
            id,
            name,
            base_course:base_courses(
              id,
              name,
              program:programs(id, name, approval_status)
            )
          )
        `)
        .eq("id", id)
        .single();

      if (errLesson || !lesson) {
        setError("Không tìm thấy bài học");
        return;
      }

      const ch = lesson.chapter as {
        id: string;
        name?: string | null;
        base_course?: {
          id: string;
          name?: string | null;
          program?: { id: string; name?: string | null; approval_status?: string } | null;
        } | null;
      } | null;

      const bcId = ch?.base_course?.id;
      if (bcId) {
        const approval = ch?.base_course?.program?.approval_status;
        if (approval === "approved") {
          router.replace(`/admin/base-courses/${bcId}`);
          return;
        }
        setBaseCourseId(bcId);
        setBaseCourseName(ch?.base_course?.name?.trim() || "");
        const prog = ch?.base_course?.program;
        if (prog?.id) {
          setProgramId(prog.id);
          setProgramName(prog.name?.trim() || "");
        }
      }
      setChapterName(ch?.name?.trim() || "");
      setName(lesson.name ?? "");
      setDescription(lesson.description ?? "");
      setVideoUrl(lesson.video_url ?? "");
      setDocumentUrl(lesson.document_url ?? "");
      setChapterId(ch?.id ?? "");
      if (!bcId) {
        setBaseCourseId("");
        setBaseCourseName("");
        setProgramId(null);
        setProgramName("");
      }

      const { data: qs } = await supabase
        .from("questions")
        .select("id, code, content, type")
        .eq("lesson_id", id)
        .order("created_at");
      setLessonQuestions(qs ?? []);

      const { data: libQs } = await supabase
        .from("questions")
        .select("id, code, content, type")
        .is("lesson_id", null)
        .order("created_at", { ascending: false })
        .limit(50);
      setLibraryQuestions(libQs ?? []);

      try {
        const result = await acquireLock("lesson", id);
        if (result.ok) {
          setHasLock(true);
          setLockError(null);
        } else {
          setLockError({ lockedBy: result.lockedBy, expiresAt: result.expiresAt });
          setHasLock(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi lấy khóa chỉnh sửa");
      }
    }
    void load().finally(() => setLoading(false));
  }, [id, supabase, router]);

  const doRelease = useCallback(() => {
    releaseLock("lesson", id);
  }, [id]);

  useEffect(() => {
    if (!hasLock) return;
    const tick = () => {
      extendLock("lesson", id).catch(() => {});
    };
    heartbeatRef.current = setInterval(tick, HEARTBEAT_MS);
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [hasLock, id]);

  useEffect(() => {
    const onBeforeUnload = () => doRelease();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [doRelease]);

  useEffect(() => {
    return () => doRelease();
  }, [doRelease]);

  async function assignQuestion(qId: string) {
    if (assigningId) return;
    setAssigningId(qId);
    try {
      const { error: err } = await supabase
        .from("questions")
        .update({ lesson_id: id, updated_at: new Date().toISOString() })
        .eq("id", qId);
      if (!err) {
        const q = libraryQuestions.find((x) => x.id === qId);
        if (q) {
          setLessonQuestions((prev) =>
            prev.some((x) => x.id === qId) ? prev : [...prev, q]
          );
          setLibraryQuestions((prev) => prev.filter((x) => x.id !== qId));
        }
      }
    } finally {
      setAssigningId(null);
    }
  }

  async function removeQuestion(qId: string) {
    const { error: err } = await supabase
      .from("questions")
      .update({ lesson_id: null, updated_at: new Date().toISOString() })
      .eq("id", qId);
    if (!err) {
      const q = lessonQuestions.find((x) => x.id === qId);
      if (q) {
        setLibraryQuestions((prev) => [q, ...prev]);
        setLessonQuestions((prev) => prev.filter((x) => x.id !== qId));
      }
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { error: err } = await supabase
        .from("lessons")
        .update({
          name: name.trim(),
          description: description.trim() || null,
          video_url: videoUrl.trim() || null,
          document_url: documentUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (err) throw new Error(err.message);
      doRelease();
      router.push(`/admin/base-courses/${baseCourseId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi cập nhật");
    } finally {
      setSubmitting(false);
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

  if (error && !name) {
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Admin" />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12">
          <p className="text-red-400">{error}</p>
          <Link href="/admin/programs" className="mt-4 inline-block text-[#D4AF37] hover:underline">
            ← Về danh sách
          </Link>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  if (lockError) {
    const backHref = baseCourseId ? `/admin/base-courses/${baseCourseId}` : "/admin/programs";
    const lessonBreadcrumbLocked = [
      { label: "Chương trình", href: "/admin/programs" },
      ...(programId ? [{ label: programName || "Chương trình", href: `/admin/programs/${programId}` }] : []),
      ...(baseCourseId ? [{ label: baseCourseName || "Khóa học cơ bản", href: `/admin/base-courses/${baseCourseId}` }] : []),
      ...(chapterName ? [{ label: chapterName }] : []),
      { label: name || "Bài học" },
    ];
    return (
      <div className="min-h-screen bg-[#0a1628]">
        <DashboardNav greeting="Admin" />
        <AdminBreadcrumbStrip items={lessonBreadcrumbLocked} />
        <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-6">
            <p className="text-lg font-medium text-amber-200">
              Bài học đang được <strong>{lockError.lockedBy}</strong> chỉnh sửa.
            </p>
            <p className="mt-2 text-sm text-amber-200/80">
              Lock hết hạn {formatExpiresAt(lockError.expiresAt)}. Vui lòng thử lại sau.
            </p>
            <Link
              href={backHref}
              className="mt-4 inline-block rounded-full border border-[#D4AF37] px-6 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              ← Quay lại
            </Link>
          </div>
        </main>
        <Footer hideLogo />
      </div>
    );
  }

  const lessonBreadcrumb = [
    { label: "Chương trình", href: "/admin/programs" },
    ...(programId
      ? [{ label: programName || "Chương trình", href: `/admin/programs/${programId}` }]
      : []),
    ...(baseCourseId
      ? [{ label: baseCourseName || "Khóa học cơ bản", href: `/admin/base-courses/${baseCourseId}` }]
      : []),
    ...(chapterName ? [{ label: chapterName }] : []),
    { label: name || "Bài học" },
  ];

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <DashboardNav greeting="Admin" />
      <AdminBreadcrumbStrip items={lessonBreadcrumb} />

      <main className="mx-auto max-w-[var(--container-max)] px-4 py-12 sm:px-6">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Chỉnh sửa bài học
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Video dùng Bunny.net, PDF dùng watermark động (Phase 3)
        </p>

        <form onSubmit={handleSubmit} className="mt-8 max-w-xl space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Tên bài học *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
              rows={2}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">URL Video (Bunny.net)</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-white/90">URL Tài liệu PDF</label>
            <input
              type="url"
              value={documentUrl}
              onChange={(e) => setDocumentUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-white/15 bg-[#0b1323] px-4 py-3 text-white outline-none focus:border-[#D4AF37]"
            />
          </div>

          {videoUrl.trim() && (
            <div>
              <p className="mb-2 text-sm font-medium text-white/90">Xem trước video (Bunny.net)</p>
              <BunnyVideoPlayer previewVideoUrl={videoUrl.trim()} className="max-w-2xl" />
            </div>
          )}

          {documentUrl.trim() && (
            <div>
              <p className="mb-2 text-sm font-medium text-white/90">Xem trước tài liệu (có watermark)</p>
              <PDFViewer previewDocumentUrl={documentUrl.trim()} className="max-w-2xl" />
            </div>
          )}

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
            <button
              type="button"
              onClick={() => {
                doRelease();
                router.push(baseCourseId ? `/admin/base-courses/${baseCourseId}` : "/admin/programs");
              }}
              className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-semibold text-gray-300 hover:bg-white/5"
            >
              Hủy
            </button>
          </div>
        </form>

        <div className="mt-10 space-y-6">
          <h2 className="text-lg font-semibold text-white">Câu hỏi trong bài học</h2>
          <p className="text-sm text-gray-400">
            Gắn câu hỏi từ thư viện để học viên làm quiz khi xem bài học.
          </p>
          {lessonQuestions.length > 0 && (
            <ul className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
              {lessonQuestions.map((q) => (
                <li
                  key={q.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-white/10 px-3 py-2"
                >
                  <span className="shrink-0 font-mono text-sm text-[#D4AF37]/90">
                    {q.code || "-"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-gray-200">{q.content}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-gray-500">{q.type}</span>
                    <Link
                      href={`/admin/question-library/${q.id}?lessonId=${id}`}
                      className="text-xs font-medium text-[#D4AF37] hover:underline"
                    >
                      Sửa
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Gỡ
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {libraryQuestions.length > 0 && (
            <details className="rounded-xl border border-white/10 bg-white/5 p-4">
              <summary className="cursor-pointer text-sm font-medium text-[#D4AF37]">
                Thêm từ thư viện ({libraryQuestions.length} câu hỏi)
              </summary>
              <ul className="mt-3 space-y-2">
                {libraryQuestions.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-white/10 px-3 py-2"
                  >
                    <span className="shrink-0 font-mono text-sm text-[#D4AF37]/90">
                      {q.code || "-"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-gray-300">{q.content}</span>
                    <button
                      type="button"
                      onClick={() => assignQuestion(q.id)}
                      disabled={assigningId === q.id}
                      className="shrink-0 rounded bg-[#D4AF37]/20 px-2 py-1 text-xs font-medium text-[#D4AF37] hover:bg-[#D4AF37]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {assigningId === q.id ? "Đang gắn..." : "Gắn vào bài"}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="text-sm text-gray-500">
            <Link
              href={`/admin/question-library/new?lessonId=${id}`}
              className="text-[#D4AF37] hover:underline"
            >
              + Thêm câu hỏi mới
            </Link>{" "}
            (gắn thẳng vào bài học)
          </p>
        </div>

        <div className="mt-10">
          <Link
            href={`/learn/preview/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[#D4AF37]/60 px-5 py-2.5 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            Xem thử bài học ↗
          </Link>
        </div>
      </main>

      <Footer hideLogo />
    </div>
  );
}
