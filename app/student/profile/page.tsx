import { createServerSupabaseClient } from "../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../lib/supabase-admin";
import StudentProfileForm from "./StudentProfileForm";

export const dynamic = "force-dynamic";

export default async function StudentProfilePage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email, address, company, phone, gender, avatar_url, student_code")
    .eq("id", user.id)
    .single();

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

  const initial = {
    fullName: p?.full_name?.trim() ?? "",
    email: p?.email?.trim() ?? user.email ?? "",
    address: p?.address?.trim() ?? "",
    company: p?.company?.trim() ?? "",
    phone: p?.phone?.trim() ?? "",
    gender: (p?.gender?.trim() || "") as "" | "male" | "female" | "other",
    avatarUrl: p?.avatar_url?.trim() ?? "",
    studentCode: p?.student_code?.trim() ?? "",
  };

  return (
    <>
      <h1 className="font-[family-name:var(--font-serif)] text-2xl font-bold text-[#D4AF37]">
        Hồ sơ cá nhân
      </h1>
      <p className="mt-2 text-gray-400">
        Cập nhật thông tin của bạn. Hệ thống sử dụng thông tin này cho chứng chỉ và liên hệ.
      </p>

      <div className="mt-8 max-w-2xl">
        <StudentProfileForm initial={initial} />
      </div>
    </>
  );
}
