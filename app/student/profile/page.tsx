import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../lib/supabase-admin";
import StudentProfileForm from "./StudentProfileForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ to?: string; required?: string }>;
};

export default async function StudentProfilePage({ searchParams }: PageProps) {
  const q = await searchParams;
  const redirectTo =
    q.to && q.to.startsWith("/") && !q.to.startsWith("//") ? q.to : null;
  const requiredGate = q.required === "1";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(
      "full_name, email, address, company, phone, gender, avatar_url, student_code"
    )
    .eq("id", user.id)
    .single();

  const { data: addressData, error: addressError } = await admin
    .from("profiles")
    .select("address_street_name, address_ward")
    .eq("id", user.id)
    .single();

  const { data: gateData, error: gateError } = await admin
    .from("profiles")
    .select("profile_completion_required")
    .eq("id", user.id)
    .single();

  const addressStreetName =
    (addressError
      ? ""
      : (addressData as { address_street_name?: string | null } | null)?.address_street_name?.trim()) ?? "";
  const addressWard =
    (addressError ? "" : (addressData as { address_ward?: string | null } | null)?.address_ward?.trim()) ?? "";
  const profileCompletionRequired =
    gateError == null
      ? (gateData as { profile_completion_required?: boolean | null } | null)?.profile_completion_required !== false
      : true;

  // #region agent log
  fetch("http://127.0.0.1:7813/ingest/2622e3a9-df77-46ca-ab07-dad3169e247f", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "cc6d23" },
    body: JSON.stringify({
      sessionId: "cc6d23",
      runId: "student-profile-page-load",
      hypothesisId: "H1",
      location: "app/student/profile/page.tsx:24",
      message: "Loaded student profile initial data",
      data: {
        hasProfile: Boolean(profile),
        profileErrorCode: profileError?.code ?? null,
        addressErrorCode: addressError?.code ?? null,
        gateErrorCode: gateError?.code ?? null,
        hasCompany: Boolean((profile as { company?: string | null } | null)?.company?.trim()),
        hasGender: Boolean((profile as { gender?: string | null } | null)?.gender?.trim()),
        hasStreet: Boolean(addressStreetName),
        hasWard: Boolean(addressWard),
        profileCompletionRequired,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const p = profile as {
    full_name?: string | null;
    email?: string | null;
    address?: string | null;
    company?: string | null;
    phone?: string | null;
    gender?: string | null;
    avatar_url?: string | null;
    student_code?: string | null;
  } | null;

  const legacy = p?.address?.trim() ?? "";
  const addressStreetDetail = addressStreetName || legacy;

  const initial = {
    fullName: p?.full_name?.trim() ?? "",
    email: p?.email?.trim() ?? user.email ?? "",
    addressStreetDetail,
    addressWard,
    addressProvince: "",
    company: p?.company?.trim() ?? "",
    phone: p?.phone?.trim() ?? "",
    gender: (p?.gender?.trim() || "") as "" | "male" | "female" | "other",
    avatarUrl: p?.avatar_url?.trim() ?? "",
    studentCode: p?.student_code?.trim() ?? "",
    profileCompletionRequired,
  };

  return (
    <>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Hồ sơ cá nhân
      </h1>
      <p className="mt-2 text-gray-400">
        Cập nhật thông tin của bạn. Hệ thống dùng cho chứng chỉ, liên hệ và tuân thủ quy định dữ liệu.
      </p>
      {requiredGate && initial.profileCompletionRequired && (
        <p className="mt-3 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Bạn cần điền họ tên và số điện thoại; đồng ý dữ liệu đã có từ đăng ký. Địa chỉ chi tiết là tùy chọn. Sau đó bạn có thể truy cập học và thanh toán.
        </p>
      )}
      {!initial.profileCompletionRequired && (
        <p className="mt-3 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm text-gray-300">
          Tài khoản của bạn không thuộc diện bắt buộc cập nhật theo đợt mới — bạn có thể chỉnh sửa tùy chọn.
        </p>
      )}

      <div className="mt-8 max-w-2xl">
        <StudentProfileForm
          initial={initial}
          redirectTo={redirectTo}
        />
      </div>
    </>
  );
}
