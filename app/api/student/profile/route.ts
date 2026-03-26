/**
 * PATCH /api/student/profile
 * Cập nhật thông tin hồ sơ học viên (địa chỉ chi tiết, SĐT, …).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../lib/csrf";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { studentProfileNeedsCompletion } from "../../../../lib/student-profile-completion";
import { fetchStudentProfileCompletion } from "../../../../lib/student-profile-api-guard";
import {
  isPhoneUniqueViolation,
  normalizePhoneToE164,
  PHONE_IN_USE_MESSAGE,
} from "../../../../lib/phone-normalize";

export async function PATCH(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const rl = await checkRateLimit(`student-profile-patch:${user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu. Thử lại sau." }, { status: 429 });
  }

  let body: {
    fullName?: string;
    address?: string;
    addressStreetDetail?: string;
    addressWard?: string;
    addressProvince?: string;
    company?: string;
    phone?: string;
    gender?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.fullName !== undefined) updates.full_name = body.fullName?.trim() || null;
  if (body.company !== undefined) updates.company = body.company?.trim() || null;
  if (body.phone !== undefined) {
    const raw = body.phone?.trim() || "";
    if (!raw) {
      updates.phone = null;
      updates.phone_e164 = null;
    } else {
      const e164 = normalizePhoneToE164(raw);
      if (!e164) {
        return NextResponse.json(
          { error: "Số điện thoại không hợp lệ. Dùng dạng trong nước (vd. 09…) hoặc quốc tế (+84…)." },
          { status: 400 }
        );
      }
      updates.phone = raw;
      updates.phone_e164 = e164;
    }
  }
  if (body.gender !== undefined) {
    const g = body.gender?.trim();
    updates.gender = ["male", "female", "other"].includes(g || "") ? g : null;
  }

  if (body.addressStreetDetail !== undefined) {
    updates.address_street_name = body.addressStreetDetail?.trim() || null;
  }
  if (body.addressWard !== undefined) {
    updates.address_ward = body.addressWard?.trim() || null;
  }
  if (body.addressProvince !== undefined) {
    updates.address_province = body.addressProvince?.trim() || null;
  }

  if (body.address !== undefined) {
    updates.address = body.address?.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    const admin = getSupabaseAdminClient();
    const { profile } = await fetchStudentProfileCompletion(admin, user.id);
    const profileComplete = !studentProfileNeedsCompletion(profile);
    return NextResponse.json({
      ok: true,
      profileComplete,
    });
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("profiles").update(updates).eq("id", user.id);

  if (error) {
    console.error("Profile update error:", error);
    if (isPhoneUniqueViolation(error)) {
      return NextResponse.json({ error: PHONE_IN_USE_MESSAGE }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { profile } = await fetchStudentProfileCompletion(admin, user.id);
  const profileComplete = !studentProfileNeedsCompletion(profile);

  return NextResponse.json({
    ok: true,
    profileComplete,
  });
}
