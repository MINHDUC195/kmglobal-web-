import OrgDomainClient from "./OrgDomainClient";

export const dynamic = "force-dynamic";

export default function OwnerOrgDomainPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
          Miễn phí theo tên miền tổ chức
        </h1>
        <p className="mt-1 text-gray-400">
          Whitelist domain, giới hạn suất, chọn khóa cơ bản (base course). User phải xác nhận email. Đồng bộ user
          hiện có khi policy active. Cron hết hạn: POST <code className="text-gray-300">/api/cron/org-domain-expiry</code>{" "}
          với CRON_SECRET.
        </p>
      </div>
      <OrgDomainClient />
    </>
  );
}
