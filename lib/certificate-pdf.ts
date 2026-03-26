import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type TextFieldConfig = {
  x?: number;
  y?: number;
  fontSize?: number;
  fontFamily?: string;
};

type AvatarFieldConfig = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type CertificateTemplateConfig = {
  fullName?: TextFieldConfig;
  studentCode?: TextFieldConfig;
  avatar?: AvatarFieldConfig;
  issueDate?: TextFieldConfig;
  certificateCode?: TextFieldConfig;
};

type GenerateCertificatePdfInput = {
  certificateCode: string;
  issueDate: Date;
  fullName: string;
  studentCode: string;
  avatarUrl?: string | null;
  templateUrl: string;
  templateConfig?: CertificateTemplateConfig | null;
};

const DEFAULT_CONFIG: Required<CertificateTemplateConfig> = {
  fullName: { x: 150, y: 380, fontSize: 14, fontFamily: "Helvetica-Bold" },
  studentCode: { x: 150, y: 350, fontSize: 12, fontFamily: "Helvetica" },
  avatar: { x: 60, y: 320, width: 70, height: 90 },
  issueDate: { x: 150, y: 300, fontSize: 11, fontFamily: "Helvetica" },
  certificateCode: { x: 150, y: 260, fontSize: 10, fontFamily: "Helvetica" },
};

const FONT_MAP: Record<string, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  "Helvetica-Bold": StandardFonts.HelveticaBold,
  "Helvetica-Oblique": StandardFonts.HelveticaOblique,
  "Helvetica-BoldOblique": StandardFonts.HelveticaBoldOblique,
  "Times-Roman": StandardFonts.TimesRoman,
  "Times-Bold": StandardFonts.TimesRomanBold,
  "Times-Italic": StandardFonts.TimesRomanItalic,
  "Times-BoldItalic": StandardFonts.TimesRomanBoldItalic,
  Courier: StandardFonts.Courier,
  "Courier-Bold": StandardFonts.CourierBold,
  "Courier-Oblique": StandardFonts.CourierOblique,
  "Courier-BoldOblique": StandardFonts.CourierBoldOblique,
};

function mergeConfig(config?: CertificateTemplateConfig | null): Required<CertificateTemplateConfig> {
  return {
    fullName: { ...DEFAULT_CONFIG.fullName, ...(config?.fullName ?? {}) },
    studentCode: { ...DEFAULT_CONFIG.studentCode, ...(config?.studentCode ?? {}) },
    avatar: { ...DEFAULT_CONFIG.avatar, ...(config?.avatar ?? {}) },
    issueDate: { ...DEFAULT_CONFIG.issueDate, ...(config?.issueDate ?? {}) },
    certificateCode: { ...DEFAULT_CONFIG.certificateCode, ...(config?.certificateCode ?? {}) },
  };
}

function getPdfFontName(raw: string | undefined): StandardFonts {
  if (!raw) return StandardFonts.Helvetica;
  return FONT_MAP[raw] ?? StandardFonts.Helvetica;
}

function formatIssueDateVi(date: Date): string {
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

async function fetchArrayBuffer(url: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Không thể tải file mẫu chứng chỉ (${res.status})`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    const data = await res.arrayBuffer();
    return { data, contentType };
  } finally {
    clearTimeout(timeout);
  }
}

function isPdfTemplate(data: ArrayBuffer, contentType: string, url: string): boolean {
  if (contentType.toLowerCase().includes("application/pdf")) return true;
  if (url.toLowerCase().includes(".pdf")) return true;
  const bytes = new Uint8Array(data.slice(0, 4));
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
}

async function embedAvatar(doc: PDFDocument, avatarUrl?: string | null) {
  if (!avatarUrl?.trim()) return null;
  try {
    const { data } = await fetchArrayBuffer(avatarUrl.trim());
    try {
      const png = await doc.embedPng(data);
      return png;
    } catch {
      const jpg = await doc.embedJpg(data);
      return jpg;
    }
  } catch {
    return null;
  }
}

export async function generateCertificatePdf(input: GenerateCertificatePdfInput): Promise<Uint8Array> {
  const cfg = mergeConfig(input.templateConfig);
  const sample = await fetchArrayBuffer(input.templateUrl);

  const outDoc = await PDFDocument.create();
  let page = outDoc.addPage([842, 595]);

  if (isPdfTemplate(sample.data, sample.contentType, input.templateUrl)) {
    const srcDoc = await PDFDocument.load(sample.data);
    const [copiedPage] = await outDoc.copyPages(srcDoc, [0]);
    outDoc.removePage(0);
    outDoc.addPage(copiedPage);
    page = outDoc.getPage(0);
  } else {
    try {
      const bgPng = await outDoc.embedPng(sample.data);
      outDoc.removePage(0);
      page = outDoc.addPage([bgPng.width, bgPng.height]);
      page.drawImage(bgPng, { x: 0, y: 0, width: bgPng.width, height: bgPng.height });
    } catch {
      const bgJpg = await outDoc.embedJpg(sample.data);
      outDoc.removePage(0);
      page = outDoc.addPage([bgJpg.width, bgJpg.height]);
      page.drawImage(bgJpg, { x: 0, y: 0, width: bgJpg.width, height: bgJpg.height });
    }
  }

  const fullNameFont = await outDoc.embedFont(getPdfFontName(cfg.fullName.fontFamily));
  const studentCodeFont = await outDoc.embedFont(getPdfFontName(cfg.studentCode.fontFamily));
  const issueDateFont = await outDoc.embedFont(getPdfFontName(cfg.issueDate.fontFamily));
  const certificateCodeFont = await outDoc.embedFont(getPdfFontName(cfg.certificateCode.fontFamily));

  page.drawText(input.fullName, {
    x: cfg.fullName.x,
    y: cfg.fullName.y,
    size: cfg.fullName.fontSize,
    font: fullNameFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(input.studentCode, {
    x: cfg.studentCode.x,
    y: cfg.studentCode.y,
    size: cfg.studentCode.fontSize,
    font: studentCodeFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(formatIssueDateVi(input.issueDate), {
    x: cfg.issueDate.x,
    y: cfg.issueDate.y,
    size: cfg.issueDate.fontSize,
    font: issueDateFont,
    color: rgb(0, 0, 0),
  });

  page.drawText(input.certificateCode, {
    x: cfg.certificateCode.x,
    y: cfg.certificateCode.y,
    size: cfg.certificateCode.fontSize,
    font: certificateCodeFont,
    color: rgb(0, 0, 0),
  });

  const avatarImage = await embedAvatar(outDoc, input.avatarUrl);
  if (avatarImage) {
    page.drawImage(avatarImage, {
      x: cfg.avatar.x,
      y: cfg.avatar.y,
      width: cfg.avatar.width,
      height: cfg.avatar.height,
    });
  }

  return outDoc.save();
}
