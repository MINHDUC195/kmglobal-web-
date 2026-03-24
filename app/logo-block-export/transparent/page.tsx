import NavLogoWithBanner from "../../../components/NavLogoWithBanner";

/** Trang export ảnh khối logo không nền (transparent, chụp bằng Puppeteer). */
export default function LogoBlockExportTransparentPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent p-8">
      <div id="logo-block-export" className="scale-[2]">
        <NavLogoWithBanner variant="transparent" />
      </div>
    </div>
  );
}
