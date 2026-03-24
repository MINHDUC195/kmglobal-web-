"use client";

import { useState } from "react";

type Chapter = {
  id: string;
  name: string;
  sortOrder: number;
  lessons: Array<{ id: string; name: string; sortOrder: number }>;
};

type Props = {
  courseName: string;
  chapters: Chapter[];
  enrolledCount: number;
  paidCount: number;
};

export default function CourseDetailModal({
  courseName,
  chapters,
  enrolledCount,
  paidCount,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[#D4AF37]/60 px-6 py-2.5 text-sm font-bold text-[#D4AF37] hover:bg-[#D4AF37]/10"
      >
        Chi tiết
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-[#0a1628] shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0a1628] p-6">
              <h3 className="text-lg font-semibold text-[#D4AF37]">Chi tiết khóa học</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white"
                aria-label="Đóng"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-sm text-gray-400">Số người đã đăng ký</p>
                  <p className="text-2xl font-bold text-[#D4AF37]">{enrolledCount}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-sm text-gray-400">Số người đã thanh toán</p>
                  <p className="text-2xl font-bold text-emerald-400">{paidCount}</p>
                </div>
              </div>

              <section>
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#D4AF37]">
                  Nội dung khóa học: {courseName}
                </h4>
                {chapters.length > 0 ? (
                  <div className="space-y-4">
                    {chapters.map((ch, i) => (
                      <div key={ch.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <h5 className="font-medium text-white">
                          Chương {i + 1}: {ch.name}
                        </h5>
                        {ch.lessons.length > 0 ? (
                          <ul className="mt-3 ml-4 space-y-2">
                            {ch.lessons.map((les) => (
                              <li key={les.id} className="text-sm text-gray-300">
                                • {les.name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-gray-500">Chưa có bài học</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">Chưa có nội dung chương</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
