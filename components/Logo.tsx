"use client";

import Image from "next/image";

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  /** light = navy text on light bg, dark = white/gold on dark bg */
  variant?: "light" | "dark" | "transparent";
};

const sizes = {
  sm: { emblem: 28, padding: 6, text: "text-sm" },
  md: { emblem: 40, padding: 8, text: "text-base" },
  lg: { emblem: 56, padding: 10, text: "text-xl" },
};

export default function Logo({ className = "", size = "sm", variant = "dark" }: LogoProps) {
  const { emblem: emblemSize, padding, text } = sizes[size];
  const mainColor = variant === "dark" ? "text-white/95" : "text-[#0a1628]";
  const emblemClasses =
    variant === "dark" || variant === "transparent"
      ? "border-[#D4AF37]/35 bg-[#2C313B] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_12px_rgba(212,175,55,0.2)]"
      : "border-[#0a1628]/20 bg-white shadow-[0_0_12px_rgba(10,22,40,0.08)]";

  return (
    <div className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-xl ${emblemClasses}`}
        style={{ width: emblemSize + padding * 2, height: emblemSize + padding * 2, padding: `${padding}px` }}
      >
        <Image
          src="/logo.ico"
          alt="KM Global"
          width={emblemSize}
          height={emblemSize}
          className="object-contain"
        />
      </div>

      {/* Text: KM GLOBAL + ACADEMY */}
      <div className="flex flex-col leading-tight">
        <span
          className={`font-[family-name:var(--font-serif)] font-bold uppercase tracking-[0.12em] ${text} ${mainColor}`}
        >
          KM GLOBAL
        </span>
        <span
          className={`font-semibold uppercase tracking-[0.2em] text-[0.65em] text-[#D4AF37]`}
        >
          ACADEMY
        </span>
      </div>
    </div>
  );
}
