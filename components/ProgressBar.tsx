"use client";

type ProgressBarProps = {
  completed: number;
  total: number;
  percent?: number;
  label?: string;
  className?: string;
  /** light = edX/learn page style, dark = default dashboard style */
  variant?: "light" | "dark";
};

export default function ProgressBar({
  completed,
  total,
  percent: percentOverride,
  label,
  className = "",
  variant = "dark",
}: ProgressBarProps) {
  const percent =
    percentOverride ??
    (total > 0 ? Math.round((completed / total) * 100) : 0);

  const isLight = variant === "light";

  return (
    <div className={className}>
      <div className="flex items-center justify-between text-sm">
        {label && (
          <span className={isLight ? "text-gray-600" : "text-gray-400"}>{label}</span>
        )}
        <span className={`font-medium ${isLight ? "text-[#002b2d]" : "text-[#D4AF37]"}`}>
          {completed}/{total} bài ({percent}%)
        </span>
      </div>
      <div className={`mt-2 h-2 w-full overflow-hidden rounded-full ${isLight ? "bg-gray-200" : "bg-white/10"}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${isLight ? "bg-[#002b2d]" : "bg-[#D4AF37]"}`}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
