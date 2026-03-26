import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

function metadataBaseUrl(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  try {
    return new URL(raw);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: {
    default: "KM Global Academy",
    template: "%s | KM Global Academy",
  },
  description:
    "Nền tảng đào tạo tiêu chuẩn quốc tế: ISO 9001, IATF 16949, ISO 14001, ISO 45001. Đào tạo chuyên sâu bởi chuyên gia hàng đầu.",
  appleWebApp: {
    title: "KM Global Academy",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a1628",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body
        className={`${beVietnam.variable} ${playfair.variable} font-sans antialiased bg-[#001529] text-white`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
