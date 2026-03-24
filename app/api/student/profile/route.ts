/**
 * PATCH /api/student/profile
 * Cập nhật thông tin hồ sơ học viên (chỉ các trường được phép).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../lib/csrf";
import { checkRateLimit } from "../../../../lib/rate-limit";

export async function PATCH(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const rl = await checkRateLimit(`student-profile-patch:${user.id}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429 }
    );
  }

  let body: {
    fullName?: string;
    address?: string;
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
  if (body.address !== undefined) updates.address = body.address?.trim() || null;
  if (body.company !== undefined) updates.company = body.company?.trim() || null;
  if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
  if (body.gender !== undefined) {
    const g = body.gender?.trim();
    updates.gender = ["male", "female", "other"].includes(g || "") ? g : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
