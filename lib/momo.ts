/**
 * MoMo payment integration - Create payment, verify webhook
 * Docs: https://developers.momo.vn/
 * Env: MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_ENV (sandbox/production)
 */

const PARTNER_CODE = process.env.MOMO_PARTNER_CODE || "";
const ACCESS_KEY = process.env.MOMO_ACCESS_KEY || "";
const SECRET_KEY = process.env.MOMO_SECRET_KEY || "";
const MOMO_ENV = process.env.MOMO_ENV || "sandbox";
const MOMO_ENDPOINT =
  MOMO_ENV === "production"
    ? "https://payment.momo.vn/v2/gateway/api/create"
    : "https://test-payment.momo.vn/v2/gateway/api/create";

type MomoPaymentParams = {
  amount: number; // VND
  orderId: string;
  orderInfo: string;
  returnUrl: string;
  notifyUrl: string;
  lang?: "vi" | "en";
};

/**
 * Create MoMo payment - returns payUrl for redirect
 */
export async function createMomoPayment(params: MomoPaymentParams): Promise<{ payUrl: string; requestId: string } | null> {
  if (!PARTNER_CODE || !ACCESS_KEY || !SECRET_KEY) return null;

  const requestId = `${params.orderId}-${Date.now()}`;
  const rawSignature = `accessKey=${ACCESS_KEY}&amount=${params.amount}&extraData=&ipnUrl=${encodeURIComponent(params.notifyUrl)}&lang=${params.lang || "vi"}&orderId=${params.orderId}&orderInfo=${params.orderInfo}&partnerCode=${PARTNER_CODE}&redirectUrl=${encodeURIComponent(params.returnUrl)}&requestId=${requestId}&requestType=captureWallet`;

  const crypto = await import("crypto");
  const signature = crypto.createHmac("sha256", SECRET_KEY).update(rawSignature).digest("hex");

  const body = {
    partnerCode: PARTNER_CODE,
    accessKey: ACCESS_KEY,
    requestId,
    amount: params.amount,
    orderId: params.orderId,
    orderInfo: params.orderInfo,
    redirectUrl: params.returnUrl,
    ipnUrl: params.notifyUrl,
    lang: params.lang || "vi",
    signature,
    requestType: "captureWallet",
  };

  try {
    const res = await fetch(MOMO_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { payUrl?: string; resultCode?: number };
    if (data.resultCode === 0 && data.payUrl) {
      return { payUrl: data.payUrl, requestId };
    }
  } catch (err) {
    console.error("MoMo create payment error:", err);
  }
  return null;
}

/** MoMo IPN payload format */
export type MomoIpnPayload = {
  orderType?: string;
  amount?: number;
  partnerCode?: string;
  orderId?: string;
  extraData?: string;
  signature?: string;
  transId?: number;
  responseTime?: number;
  resultCode?: number;
  message?: string;
  payType?: string;
  requestId?: string;
  orderInfo?: string;
};

/**
 * Verify MoMo IPN signature and check resultCode
 * Returns true if valid and payment succeeded (resultCode 0 or 9000)
 */
export async function verifyMomoIpn(payload: MomoIpnPayload): Promise<boolean> {
  if (!SECRET_KEY || !payload.signature) return false;
  if (payload.resultCode !== 0 && payload.resultCode !== 9000) return false;

  const rawSignature = [
    `accessKey=${ACCESS_KEY}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData ?? ""}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo ?? ""}`,
    `orderType=${payload.orderType ?? "momo_wallet"}`,
    `partnerCode=${payload.partnerCode}`,
    `requestId=${payload.requestId ?? ""}`,
    `responseTime=${payload.responseTime}`,
    `resultCode=${payload.resultCode}`,
    `transId=${payload.transId}`,
  ].join("&");

  const crypto = await import("crypto");
  const expectedSig = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(rawSignature)
    .digest("hex");
  return expectedSig === payload.signature;
}
