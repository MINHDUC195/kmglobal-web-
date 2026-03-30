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
    if (!Number.isFinite(d) || !Number.isInteger(d) || d < 0 || d > 99) return null;
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

export type TierFormRow = { slots: string; discount: string };

/** Đổ `promotion_tiers` hợp lệ từ DB → ô form (đợt có suất + đuôi). */
export function promotionTiersToFormRows(raw: unknown): {
  rows: TierFormRow[];
  tailDiscount: string;
} {
  const tiers = parsePromotionTiers(raw);
  if (!tiers?.length) {
    return { rows: [{ slots: "", discount: "" }], tailDiscount: "" };
  }
  const capped = tiers.filter((t): t is PromotionTier & { slots: number } => t.slots != null);
  const last = tiers[tiers.length - 1];
  return {
    rows:
      capped.length > 0
        ? capped.map((t) => ({ slots: String(t.slots), discount: String(t.discount_percent) }))
        : [{ slots: "", discount: "" }],
    tailDiscount: last?.slots == null ? String(last.discount_percent) : "",
  };
}

/** Từ ô form → object lưu DB. Ném Error (tiếng Việt) nếu không hợp lệ. */
export function buildPromotionTiersFromFormRows(
  cappedRows: TierFormRow[],
  tailDiscountStr: string
): object {
  const tailTrim = tailDiscountStr.trim();
  const tailD = tailTrim === "" ? 0 : Math.round(parseFloat(tailDiscountStr));
  if (tailTrim !== "" && (!Number.isFinite(tailD) || tailD < 0 || tailD > 99)) {
    throw new Error("Đợt không giới hạn suất: % giảm giá phải là số nguyên 0–99 (để trống = 0%).");
  }

  const capped: { slots: number; discount_percent: number }[] = [];
  for (const r of cappedRows) {
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
  if (d != null && d >= 0 && d <= 99) return d;
  return null;
}

export type CachHaiLine = {
  text: string;
  tone: "active" | "exhausted" | "pending" | "tail_pending" | "tail_active";
};

function tierDiscountPhrase(d: number): string {
  if (d <= 0) return "giá gốc (0%)";
  return `-${d}%`;
}

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
          text: `Đợt 1: Còn ${end - n}/${S} suất · ${tierDiscountPhrase(D)}`,
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
          text: `Đợt ${i + 1}: Còn ${end - n}/${S} suất · ${tierDiscountPhrase(D)}`,
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
      text: `${afterCappedLabel}: ${tierDiscountPhrase(dTail)} (không giới hạn suất)`,
      tone: "tail_pending",
    });
  } else {
    lines.push({
      text: `Đang áp dụng: ${tierDiscountPhrase(dTail)} (không giới hạn suất)`,
      tone: "tail_active",
    });
  }

  return lines;
}
