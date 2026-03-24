/**
 * PDF watermark - thêm watermark động (user, email) lên PDF
 * Dùng pdf-lib để xử lý server-side
 */

import { PDFDocument, rgb, degrees } from "pdf-lib";

export interface WatermarkOptions {
  /** Tên hiển thị (user) */
  userName: string;
  /** Email */
  userEmail: string;
  /** Độ mờ watermark (0-1) */
  opacity?: number;
  /** Cỡ chữ */
  fontSize?: number;
}

/**
 * Thêm watermark lên tất cả trang PDF
 * @param pdfBuffer - Buffer PDF gốc
 * @param options - Thông tin user để hiển thị
 * @returns Buffer PDF đã có watermark
 */
export async function addWatermarkToPdf(
  pdfBuffer: ArrayBuffer,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const { userName, userEmail, opacity = 0.15, fontSize = 10 } = options;
  const doc = await PDFDocument.load(pdfBuffer);
  const pages = doc.getPages();

  const watermarkText = `${userName} · ${userEmail}`;

  for (const page of pages) {
    const { width, height } = page.getSize();
    const step = 150;

    for (let y = -height; y < height * 2; y += step) {
      for (let x = -width; x < width * 2; x += step * 2) {
        page.drawText(watermarkText, {
          x,
          y,
          size: fontSize,
          opacity,
          rotate: degrees(-45),
          color: rgb(0.5, 0.5, 0.5),
        });
      }
    }
  }

  return await doc.save();
}
