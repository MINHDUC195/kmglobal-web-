/**
 * VNPay integration - Build payment URL, verify return/IPN
 * Docs: https://sandbox.vnpayment.vn/apis/docs/
 * Env: VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_URL (sandbox or prod)
 */

import { createHmac } from "crypto";

const TMN_CODE = process.env.VNPAY_TMN_CODE || "";
const HASH_SECRET = process.env.VNPAY_HASH_SECRET || "";
const VNPAY_URL = process.env.VNPAY_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

export type VnpayParams = {
  amount: number; // VND
  orderId: string;
  orderInfo: string;
  returnUrl: string;
  ipAddr?: string;
  locale?: "vn" | "en";
};

/**
 * Build VNPay payment URL
 */
export function buildVnpayPaymentUrl(params: VnpayParams): string {
  const vnpParams: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: TMN_CODE,
    vnp_Amount: String(params.amount * 100), // VNPay expects amount * 100
    vnp_CurrCode: "VND",
    vnp_TxnRef: params.orderId,
    vnp_OrderInfo: params.orderInfo,
    vnp_OrderType: "other",
    vnp_Locale: params.locale || "vn",
    vnp_ReturnUrl: params.returnUrl,
    vnp_IpAddr: params.ipAddr || "127.0.0.1",
    vnp_CreateDate: new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14),
  };

  const sortedKeys = Object.keys(vnpParams).sort();
  const signData = sortedKeys
    .filter((k) => vnpParams[k])
    .map((k) => `${k}=${encodeURIComponent(vnpParams[k])}`)
    .join("&");

  const hmac = createHmac("sha512", HASH_SECRET);
  hmac.update(Buffer.from(signData, "utf-8"));
  const vnp_SecureHash = hmac.digest("hex");

  return `${VNPAY_URL}?${signData}&vnp_SecureHash=${vnp_SecureHash}`;
}

/**
 * Verify VNPay return/IPN callback signature
 */
export function verifyVnpayReturn(query: Record<string, string>): boolean {
  const secureHash = query.vnp_SecureHash;
  const secureHashType = query.vnp_SecureHashType || "sha512";
  if (!secureHash) return false;

  const rest = { ...query };
  delete rest.vnp_SecureHash;
  delete rest.vnp_SecureHashType;
  const sortedKeys = Object.keys(rest).sort();
  const signData = sortedKeys
    .filter((k) => rest[k])
    .map((k) => `${k}=${encodeURIComponent(rest[k])}`)
    .join("&");

  const hmac = createHmac(secureHashType, HASH_SECRET);
  hmac.update(Buffer.from(signData, "utf-8"));
  const expected = hmac.digest("hex");
  return secureHash === expected;
}

export function isVnpayConfigured(): boolean {
  return Boolean(TMN_CODE && HASH_SECRET);
}
