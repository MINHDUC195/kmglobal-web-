/**
 * promotion_tiers: [{ slots: number, discount_percent }, ..., { slots: null, discount_percent }]
 * Phần tử cuối slots=null = đợt không giới hạn. Khi hợp lệ → giá chỉ theo tier (không dùng discount_percent).
 */

export type PromotionTier = { slots: number | null; discount_percent: number };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Hợp lệ: ≥2 phần tử, các phần tử trước cuối có slots nguyên ≥1, cuối cùng slots === null. */
export function parsePromotionTiers(raw: unknown): PromotionTier[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const out: PromotionTier[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isRecord(item)) return null;
    const d = Number(item.discount_percent);
    if (!Number.isFinite(d) || d < 1 || d > 99) return null;
    const isLast = i === raw.length - 1;
    if (isLast) {
      if (item.slots != null) return null;
      out.push({ slots: null, discount_percent: d });
    } else {
      const s = Number(item.slots);
      if (!Number.isFinite(s) || s < 1 || !Number.isInteger(s)) return null;
      out.push({ slots: s, discount_percent: d });
    }
  }
  return out;
}

function cappedTotalSlots(tiers: PromotionTier[]): number {
  let s = 0;
  for (const t of tiers) {
    if (t.slots != null) s += t.slots;
  }
  return s;
}

/** Giảm % cho lượt đăng ký tiếp theo (đã có n enrollment active). */
export function discountForNextEnrollment(
  tiers: PromotionTier[] | null,
  activeEnrollmentCount: number
): number | null {
  if (!tiers?.length) return null;
  const n = Math.max(0, Math.floor(activeEnrollmentCount));
  let cum = 0;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (t.slots == null) return t.discount_percent;
    const cap = cum + t.slots;
    if (n < cap) return t.discount_percent;
    cum = cap;
  }
  return tiers[tiers.length - 1]?.discount_percent ?? null;
}

/** Có promotion_tiers hợp lệ → chỉ tier; không thì discount_percent cố định. */
export function getEffectiveDiscountPercent(
  promotionTiersRaw: unknown,
  staticDiscountPercent: number | null | undefined,
  activeEnrollmentCount: number
): number | null {
  const tiers = parsePromotionTiers(promotionTiersRaw);
  if (tiers?.length) {
    return discountForNextEnrollment(tiers, activeEnrollmentCount);
  }
  const d = staticDiscountPercent;
  if (d != null && d >= 1 && d <= 99) return d;
  return null;
}

export type CachHaiLine = {
  text: string;
  tone: "active" | "exhausted" | "pending" | "tail_pending" | "tail_active";
};

/** UI Cách 2: luôn đủ dòng cho mỗi đợt (capped + đợt đuôi). */
export function buildPromotionTierCachHaiLines(
  activeEnrollmentCount: number,
  promotionTiersRaw: unknown
): CachHaiLine[] | null {
  const tiers = parsePromotionTiers(promotionTiersRaw);
  if (!tiers?.length) return null;
  const n = Math.max(0, Math.floor(activeEnrollmentCount));
  const capped = tiers.filter((t): t is PromotionTier & { slots: number } => t.slots != null);
  const tail = tiers[tiers.length - 1];
  if (tail.slots != null) return null;

  const lines: CachHaiLine[] = [];
  let cum = 0;

  for (let i = 0; i < capped.length; i++) {
    const t = capped[i];
    const S = t.slots;
    const D = t.discount_percent;
    const start = cum;
    const end = cum + S;
    cum = end;

    if (i === 0) {
      if (n < end) {
        lines.push({
          text: `Đợt 1: Còn ${end - n}/${S} suất · -${D}%`,
          tone: "active",
        });
      } else {
        lines.push({
          text: `Đợt 1: Còn 0/${S} suất (đã hết)`,
          tone: "exhausted",
        });
      }
    } else {
      if (n < start) {
        lines.push({
          text: `Đợt ${i + 1}: Chưa mở`,
          tone: "pending",
        });
      } else if (n < end) {
        lines.push({
          text: `Đợt ${i + 1}: Còn ${end - n}/${S} suất · -${D}%`,
          tone: "active",
        });
      } else {
        lines.push({
          text: `Đợt ${i + 1}: Còn 0/${S} suất (đã hết)`,
          tone: "exhausted",
        });
      }
    }
  }

  const capTotal = cappedTotalSlots(tiers);
  const dTail = tail.discount_percent;
  const afterCappedLabel =
    capped.length === 1
      ? "Sau khi hết đợt 1"
      : capped.length === 2
        ? "Sau khi hết đợt 1 và 2"
        : `Sau khi hết các đợt 1–${capped.length}`;

  if (n < capTotal) {
    lines.push({
      text: `${afterCappedLabel}: -${dTail}% (không giới hạn suất)`,
      tone: "tail_pending",
    });
  } else {
    lines.push({
      text: `Đang áp dụng: -${dTail}% (không giới hạn suất)`,
      tone: "tail_active",
    });
  }

  return lines;
}
