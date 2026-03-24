"use client";

import { useState } from "react";

type LearnSidebarProps = {
  enrollmentId: string;
};

const GOALS = [
  { key: "casual", label: "Nhẹ", days: "1 ngày/tuần" },
  { key: "regular", label: "Vừa phải", days: "3 ngày/tuần" },
  { key: "intense", label: "Chuyên sâu", days: "5 ngày/tuần" },
] as const;

export default function LearnSidebar({ enrollmentId }: LearnSidebarProps) {
  const [goal, setGoal] = useState<"casual" | "regular" | "intense">("regular");
  const [reminder, setReminder] = useState(false);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-[#002b2d]">Mục tiêu học tập hàng tuần</h3>
        <p className="mt-1 text-sm text-gray-600">
          Đặt mục tiêu giúp bạn duy trì động lực hoàn thành khóa học.
        </p>
        <div className="mt-4 space-y-2">
          {GOALS.map((g) => (
            <button
              key={g.key}
              type="button"
              onClick={() => setGoal(g.key)}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                goal === g.key
                  ? "border-[#002b2d] bg-[#002b2d]/5 text-[#002b2d]"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="font-medium">{g.label}</span>
              <span className="text-gray-500">{g.days}</span>
            </button>
          ))}
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={reminder}
            onChange={(e) => setReminder(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#002b2d] focus:ring-[#002b2d]"
          />
          <span className="text-sm text-gray-700">Nhắc nhở mục tiêu</span>
        </label>
      </div>
    </div>
  );
}
