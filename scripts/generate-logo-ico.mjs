import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import toIco from "to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, "../public/logo-icon.svg");
const outputPath = path.join(__dirname, "../public/logo-kmglobal-academy.ico");
const appFaviconPath = path.join(__dirname, "../app/favicon.ico");

const svgBuffer = fs.readFileSync(svgPath);
const sizes = [16, 32, 48, 256];

const pngBuffers = await Promise.all(
  sizes.map((size) =>
    sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toBuffer()
  )
);

const icoBuffer = await toIco(pngBuffers);
fs.writeFileSync(outputPath, icoBuffer);
fs.writeFileSync(appFaviconPath, icoBuffer);
console.log(`Created ${outputPath}`);
console.log(`Created ${appFaviconPath} (tab favicon)`);
