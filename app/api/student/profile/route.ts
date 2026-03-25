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
    updates.phone = body.phone?.trim() || null;
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
    const { profile, error: completionError, degraded } = await fetchStudentProfileCompletion(admin, user.id);
    const profileComplete = !studentProfileNeedsCompletion(profile);
    // #region agent log
    fetch("http://127.0.0.1:7813/ingest/2622e3a9-df77-46ca-ab07-dad3169e247f", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "cc6d23" },
      body: JSON.stringify({
        sessionId: "cc6d23",
        runId: "student-profile-patch",
        hypothesisId: "H5",
        location: "app/api/student/profile/route.ts:73",
        message: "No updates branch completion check",
        data: {
          updatesCount: 0,
          completionErrorCode: completionError?.code ?? null,
          degraded,
          profileComplete,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return NextResponse.json({
      ok: true,
      profileComplete,
    });
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin.from("profiles").update(updates).eq("id", user.id);

  // #region agent log
  fetch("http://127.0.0.1:7813/ingest/2622e3a9-df77-46ca-ab07-dad3169e247f", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "cc6d23" },
    body: JSON.stringify({
      sessionId: "cc6d23",
      runId: "student-profile-patch",
      hypothesisId: "H4",
      location: "app/api/student/profile/route.ts:87",
      message: "Applied profile updates",
      data: {
        updateKeys: Object.keys(updates),
        updateErrorCode: error?.code ?? null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { profile, error: completionError, degraded } = await fetchStudentProfileCompletion(admin, user.id);
  const profileComplete = !studentProfileNeedsCompletion(profile);

  // #region agent log
  fetch("http://127.0.0.1:7813/ingest/2622e3a9-df77-46ca-ab07-dad3169e247f", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "cc6d23" },
    body: JSON.stringify({
      sessionId: "cc6d23",
      runId: "student-profile-patch",
      hypothesisId: "H2",
      location: "app/api/student/profile/route.ts:94",
      message: "Completion status after profile update",
      data: {
        completionErrorCode: completionError?.code ?? null,
        degraded,
        hasFullName: Boolean((profile as { full_name?: string | null } | null)?.full_name?.trim()),
        hasPhone: Boolean((profile as { phone?: string | null } | null)?.phone?.trim()),
        hasConsent: Boolean((profile as { data_sharing_consent_at?: string | null } | null)?.data_sharing_consent_at),
        profileComplete,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return NextResponse.json({
    ok: true,
    profileComplete,
  });
}
