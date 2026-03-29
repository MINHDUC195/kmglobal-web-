import { createHash, randomBytes } from "crypto";

const TOKEN_BYTES = 32;

export function generateAdminPromotionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashAdminPromotionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Thời hạn liên kết xác nhận (giờ). */
export const ADMIN_PROMOTION_TOKEN_TTL_HOURS = 24;
