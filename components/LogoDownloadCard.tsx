"use client";

type LogoDownloadCardProps = {
  title: string;
  desc: string;
  src: string;
  pngSrc?: string;
  svgFilename: string;
  pngFilename: string;
  imgId: string;
};

export default function LogoDownloadCard({
  title,
  desc,
  src,
  pngSrc,
  svgFilename,
  pngFilename,
  imgId,
}: LogoDownloadCardProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6">
      <h2 className="mb-2 text-sm font-semibold text-[#D4AF37]">{title}</h2>
      <p className="mb-4 text-xs text-gray-500">{desc}</p>
      <div className="mb-4 flex min-h-[100px] items-center justify-center rounded-lg bg-[#0a1628] p-4">
        <img
          id={imgId}
          src={pngSrc ?? src}
          alt={title}
          className="max-h-full w-auto"
          width={280}
          height={70}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={src}
          download={svgFilename}
          className="rounded-lg bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
        >
          Tải SVG
        </a>
        <a
          href={pngSrc ?? src}
          download={pngFilename}
          className="rounded-lg border-2 border-[#D4AF37] px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10"
        >
          Tải PNG
        </a>
      </div>
    </div>
  );
}
