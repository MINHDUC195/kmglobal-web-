import { buildPromotionTierCachHaiLines } from "../lib/promotion-tiers";

const toneClass: Record<string, string> = {
  active: "text-emerald-300 font-medium",
  exhausted: "text-gray-500 line-through decoration-gray-500/50",
  pending: "text-gray-500",
  tail_pending: "text-amber-200/90",
  tail_active: "text-emerald-300 font-medium",
};

type Props = {
  activeEnrollmentCount: number;
  promotionTiers: unknown;
  className?: string;
};

/** UI Cách 2: luôn liệt kê đủ đợt (có giới hạn + đuôi không giới hạn). */
export default function PromotionTiersCachHai({
  activeEnrollmentCount,
  promotionTiers,
  className = "",
}: Props) {
  const lines = buildPromotionTierCachHaiLines(activeEnrollmentCount, promotionTiers);
  if (!lines?.length) return null;

  return (
    <ul className={`space-y-1.5 text-xs sm:text-sm ${className}`} aria-label="Các đợt ưu đãi theo suất">
      {lines.map((line, idx) => (
        <li key={idx} className={toneClass[line.tone] ?? "text-gray-400"}>
          {line.text}
        </li>
      ))}
    </ul>
  );
}
