"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Logo from "./Logo";

const LOGO_INTRINSIC_WIDTH = 148;
const LOGO_INTRINSIC_HEIGHT = 40;

type NavLogoWithBannerProps = {
  /** Scale multiplier, e.g. 1.3 = 30% larger */
  scale?: number;
  /** light = white bg + navy text, dark = dark bg + white/gold, transparent = no bg */
  variant?: "light" | "dark" | "transparent";
};

export default function NavLogoWithBanner({ scale: scaleMultiplier = 1, variant = "dark" }: NavLogoWithBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const banner = bannerRef.current;
    if (!banner) return;
    const update = () => {
      const w = banner.offsetWidth;
      setScale(w / LOGO_INTRINSIC_WIDTH);
    };
    const observer = new ResizeObserver(update);
    observer.observe(banner);
    update();
    return () => observer.disconnect();
  }, []);

  const isLight = variant === "light";
  const isTransparent = variant === "transparent";
  const containerClasses = isTransparent
    ? "inline-flex flex-col items-start gap-1.5"
    : isLight
      ? "inline-flex flex-col items-start gap-1.5 rounded-lg border border-[#0a1628]/15 bg-white px-3 py-2 shadow-sm"
      : "inline-flex flex-col items-start gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors hover:border-[#D4AF37]/30 hover:bg-white/[0.05]";

  return (
    <Link
      href="/"
      className={containerClasses}
      style={
        scaleMultiplier !== 1
          ? { transform: `scale(${scaleMultiplier})`, transformOrigin: "left top" }
          : undefined
      }
    >
      <div
        className="overflow-hidden"
        style={{
          width: LOGO_INTRINSIC_WIDTH * scale,
          height: LOGO_INTRINSIC_HEIGHT * scale,
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "left top",
          }}
        >
          <Logo size="sm" variant={variant} />
        </div>
      </div>
      <div
        ref={bannerRef}
        className={
          isTransparent
            ? "inline-flex w-fit items-center gap-1 rounded-full border border-[#D4AF37]/40 px-1.5 py-0.5"
            : isLight
              ? "inline-flex w-fit items-center gap-1 rounded-full border border-[#D4AF37]/40 bg-[#0a1628]/5 px-1.5 py-0.5"
              : "inline-flex w-fit items-center gap-1 rounded-full border border-[#D4AF37]/50 bg-[#282c36] px-1.5 py-0.5 shadow-[0_0_6px_rgba(212,175,55,0.08)]"
        }
      >
        <svg width="7" height="7" viewBox="0 0 24 24" fill="#D4AF37" className="shrink-0" aria-hidden>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <span className="text-[10px] font-semibold uppercase text-[#D4AF37] leading-tight">Nền tảng đào tạo hàng đầu</span>
      </div>
    </Link>
  );
}
