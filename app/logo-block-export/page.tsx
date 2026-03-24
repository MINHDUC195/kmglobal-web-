import NavLogoWithBanner from "../../components/NavLogoWithBanner";

/** Trang dùng để export ảnh khối logo (chụp màn hình bằng Puppeteer). */
export default function LogoBlockExportPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a1628] p-8">
      <div id="logo-block-export" className="scale-[2]">
        <NavLogoWithBanner />
      </div>
    </div>
  );
}
