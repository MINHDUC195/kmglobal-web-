/**
 * Chụp màn hình khối logo không nền (transparent PNG).
 * Yêu cầu: chạy `npm run dev` trước khi chạy script này.
 * Run: npm run generate:logo-block-transparent-png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");
const OUTPUT_FILE = path.join(publicDir, "logo-block-transparent.png");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function waitForServer(ms = 5000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(`${BASE_URL}/logo-block-export/transparent`);
      if (res.ok) return true;
    } catch {
      // Server not ready
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  const { default: puppeteer } = await import("puppeteer");

  const ready = await waitForServer();
  if (!ready) {
    console.error("❌ Dev server chưa chạy. Hãy chạy: npm run dev");
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 2 });
  await page.goto(`${BASE_URL}/logo-block-export/transparent`, { waitUntil: "networkidle0" });

  await page.evaluate(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  });

  const el = await page.$("#logo-block-export");

  if (!el) {
    console.error("❌ Không tìm thấy element #logo-block-export");
    await browser.close();
    process.exit(1);
  }

  const box = await el.boundingBox();
  if (!box) {
    console.error("❌ Không lấy được kích thước element");
    await browser.close();
    process.exit(1);
  }

  const buffer = await page.screenshot({
    type: "png",
    omitBackground: true,
    clip: { x: box.x, y: box.y, width: box.width, height: box.height },
  });
  fs.writeFileSync(OUTPUT_FILE, buffer);
  console.log("✅ Đã tạo: public/logo-block-transparent.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
