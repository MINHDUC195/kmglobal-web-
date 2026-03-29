/**
 * Giá khóa học và giảm giá.
 * price_cents: giá gốc (VNĐ)
 * discount_percent: phần trăm giảm (0–99; dưới 1% coi như không giảm), null = không giảm
 */

export function getSalePriceCents(
  priceCents: number,
  discountPercent: number | null | undefined
): number {
  if (!discountPercent || discountPercent < 1 || discountPercent > 99) return priceCents;
  return Math.round((priceCents * (100 - discountPercent)) / 100);
}

export function formatPriceDisplay(
  priceCents: number,
  discountPercent: number | null | undefined
): {
  /** Chuỗi hiển thị (VD: "990.000 ₫" hoặc "Miễn phí") */
  display: string;
  /** Có đang giảm giá không */
  hasDiscount: boolean;
  /** Giá gốc đã format (khi có giảm) */
  originalDisplay: string | null;
  /** Giá sau giảm */
  saleDisplay: string | null;
} {
  if (priceCents <= 0) {
    return { display: "Miễn phí", hasDiscount: false, originalDisplay: null, saleDisplay: null };
  }
  const saleCents = getSalePriceCents(priceCents, discountPercent);
  const hasDiscount = saleCents < priceCents && (discountPercent ?? 0) >= 1;
  const fmt = (c: number) => new Intl.NumberFormat("vi-VN").format(c) + " ₫";
  return {
    display: fmt(hasDiscount ? saleCents : priceCents),
    hasDiscount,
    originalDisplay: hasDiscount ? fmt(priceCents) : null,
    saleDisplay: hasDiscount ? fmt(saleCents) : null,
  };
}
