import NavLogoWithBanner from "../../../components/NavLogoWithBanner";

/** Trang export ảnh khối logo phiên bản nền trắng, chữ Navy (chụp bằng Puppeteer). */
export default function LogoBlockExportLightPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-8">
      <div id="logo-block-export" className="scale-[2]">
        <NavLogoWithBanner variant="light" />
      </div>
    </div>
  );
}
