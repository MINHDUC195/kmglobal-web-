/**
 * Đối soát số tiền: phải khớp payments.amount_cents (VNĐ nguyên, cùng quy ước với checkout/init)
 * trước khi đánh dấu completed — chống ghi nhận sai dù chữ ký cổng vẫn hợp lệ trong biến thể lạ.
 */

/** MoMo IPN: amount là VND (số nguyên), khớp amount_cents đã lưu khi tạo đơn */
export function momoIpnAmountMatchesDb(ipnAmount: unknown, amountCents: number): boolean {
  const a = typeof ipnAmount === "number" ? ipnAmount : Number(ipnAmount);
  const db = Number(amountCents);
  if (!Number.isFinite(a) || !Number.isFinite(db)) return false;
  return Math.round(a) === Math.round(db);
}

/**
 * VNPay query: lib/vnpay buildVnpayPaymentUrl dùng vnp_Amount = amountVND * 100
 */
export function vnpayQueryAmountToVnd(vnpAmount: string | undefined): number | null {
  if (vnpAmount == null || vnpAmount === "") return null;
  const n = parseInt(String(vnpAmount), 10);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.floor(n / 100);
}

export function vnpayAmountMatchesDb(vnpAmount: string | undefined, amountCents: number): boolean {
  const vnd = vnpayQueryAmountToVnd(vnpAmount);
  if (vnd === null) return false;
  return vnd === Math.round(Number(amountCents));
}

/** Stripe Checkout Session: amount_total (VND zero-decimal) khớp amount_cents */
export function stripeSessionAmountMatchesDb(amountTotal: unknown, amountCents: number): boolean {
  if (amountTotal == null) return false;
  const t = typeof amountTotal === "number" ? amountTotal : Number(amountTotal);
  const db = Number(amountCents);
  if (!Number.isFinite(t) || !Number.isFinite(db)) return false;
  return Math.round(t) === Math.round(db);
}
