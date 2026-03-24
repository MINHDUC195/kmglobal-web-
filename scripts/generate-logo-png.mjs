/**
 * Generate PNG from logo SVG using Puppeteer for correct font/icon rendering.
 * Run: npm run generate:logo-png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

async function main() {
  const { default: puppeteer } = await import("puppeteer");

  const svgSimple = fs.readFileSync(path.join(publicDir, "logo-kmglobal-academy.svg"), "utf-8");
  const svgFull = fs.readFileSync(path.join(publicDir, "logo-kmglobal-academy-full.svg"), "utf-8");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 20px; background: #0a1628; }
    .logo { display: inline-block; }
  </style>
</head>
<body>
  <div id="logo-simple" class="logo">${svgSimple}</div>
  <div id="logo-full" class="logo" style="margin-top: 20px;">${svgFull}</div>
</body>
</html>`;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 640, height: 400 });
  await page.setContent(html, { waitUntil: "networkidle0" });

  const simpleEl = await page.$("#logo-simple svg");
  const fullEl = await page.$("#logo-full svg");

  if (simpleEl) {
    const buffer = await simpleEl.screenshot({ type: "png" });
    fs.writeFileSync(path.join(publicDir, "logo-kmglobal-academy.png"), buffer);
    console.log("Created: public/logo-kmglobal-academy.png");
  }

  if (fullEl) {
    const buffer = await fullEl.screenshot({ type: "png" });
    fs.writeFileSync(path.join(publicDir, "logo-kmglobal-academy-full.png"), buffer);
    console.log("Created: public/logo-kmglobal-academy-full.png");
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
