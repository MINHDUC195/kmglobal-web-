#!/usr/bin/env node
/**
 * Kiểm tra biến môi trường trước khi deploy production / UAT.
 *
 * Usage:
 *   node scripts/check-production-env.mjs
 *   node scripts/check-production-env.mjs --require-payments
 *   node scripts/check-production-env.mjs --warn-redis
 *
 * Load .env.local tự động nếu có (không ghi đè biến đã set trong shell).
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envLocal = join(root, ".env.local");

function loadEnvLocal() {
  if (!existsSync(envLocal)) return;
  const raw = readFileSync(envLocal, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvLocal();

const args = process.argv.slice(2);
const requirePayments = args.includes("--require-payments");
const warnRedis = args.includes("--warn-redis");

const errors = [];
const warnings = [];

function need(name, placeholder) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    errors.push(`Thiếu hoặc rỗng: ${name}`);
    return false;
  }
  if (placeholder && String(v).includes(placeholder)) {
    errors.push(`${name} vẫn là giá trị mẫu (${placeholder})`);
    return false;
  }
  return true;
}

function want(name, message) {
  const v = process.env[name];
  if (!v || !String(v).trim()) warnings.push(message);
}

// --- Bắt buộc cho mọi môi trường chạy app ---
need("NEXT_PUBLIC_SUPABASE_URL", "your-project");
need("NEXT_PUBLIC_SUPABASE_ANON_KEY", "your-anon");
need("SUPABASE_SERVICE_ROLE_KEY", "your-service-role");

// Site URL: CSRF + metadata — production build từ chối POST nếu thiếu (lib/csrf.ts)
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
if (!siteUrl || !String(siteUrl).trim()) {
  if (process.env.VERCEL) {
    errors.push(
      "Deploy Vercel: bắt buộc NEXT_PUBLIC_SITE_URL hoặc NEXT_PUBLIC_APP_URL (https://domain-của-bạn) — CSRF và một số API sẽ 403 nếu thiếu."
    );
  } else {
    warnings.push(
      "Nên đặt NEXT_PUBLIC_SITE_URL (hoặc NEXT_PUBLIC_APP_URL) đúng domain production. " +
        "Khi chạy `next start` (NODE_ENV=production), thiếu biến này sẽ khiến validateOrigin từ chối mọi POST state-changing."
    );
  }
} else {
  try {
    const u = new URL(siteUrl);
    if (u.protocol !== "https:" && process.env.NODE_ENV === "production") {
      warnings.push("Production nên dùng https:// cho NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL.");
    }
  } catch {
    errors.push("NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_APP_URL không phải URL hợp lệ.");
  }
}

// Bunny (video)
want(
  "BUNNY_STREAM_LIBRARY_ID",
  "Video: nên có BUNNY_STREAM_LIBRARY_ID (và token nếu dùng signed URL)."
);

// Payments: với --require-payments cần ít nhất một cổng cấu hình đủ (UAT từng cổng)
if (requirePayments) {
  const vnp = process.env.VNPAY_TMN_CODE && process.env.VNPAY_HASH_SECRET;
  const momo =
    process.env.MOMO_PARTNER_CODE &&
    process.env.MOMO_ACCESS_KEY &&
    process.env.MOMO_SECRET_KEY;
  const stripe =
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!vnp && !momo && !stripe) {
    errors.push(
      "--require-payments: cần ít nhất một cổng cấu hình đủ — VNPay (VNPAY_TMN_CODE + VNPAY_HASH_SECRET), " +
        "hoặc MoMo (PARTNER + ACCESS + SECRET), hoặc Stripe (SECRET + WEBHOOK + PUBLISHABLE)."
    );
  }
}

// Upstash: cả hai hoặc không
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
if (redisUrl && !redisToken) errors.push("Có UPSTASH_REDIS_REST_URL nhưng thiếu UPSTASH_REDIS_REST_TOKEN.");
if (!redisUrl && redisToken) errors.push("Có UPSTASH_REDIS_REST_TOKEN nhưng thiếu UPSTASH_REDIS_REST_URL.");
if (warnRedis && !redisUrl && !redisToken) {
  warnings.push(
    "Chưa cấu hình Upstash Redis (UPSTASH_REDIS_*). Rate limit và idempotency checkout dùng bộ nhớ trong process — " +
      "khi scale nhiều instance nên bật Redis."
  );
}

for (const w of warnings) console.warn(`[cảnh báo] ${w}`);
for (const e of errors) console.error(`[lỗi] ${e}`);

if (errors.length) {
  console.error(`\nThất bại: ${errors.length} lỗi.`);
  process.exit(1);
}

console.log("OK: biến môi trường tối thiểu đã đủ (xem cảnh báo nếu có).");
process.exit(0);
