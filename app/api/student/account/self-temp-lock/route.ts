/**
 * POST /api/student/account/self-temp-lock
 * Học viên đã từng thanh toán thành công có thể tự tạm khóa 3 ngày.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../../lib/csrf";
import { sendKmgEmail, tempLockEmailHtml } from "../../../../../lib/email-notify";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  const { data: paid } = await admin
    .from("payments")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();

  if (!paid) {
    return NextResponse.json(
      { error: "Chỉ học viên đã từng thanh toán thành công mới dùng được tính năng này." },
      { status: 400 }
    );
  }

  const until = new Date(Date.now() + THREE_DAYS_MS);
  const { error } = await admin
    .from("profiles")
    .update({ self_temp_lock_until: until.toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("self-temp-lock:", error);
    return NextResponse.json({ error: "Không thể kích hoạt tạm khóa" }, { status: 500 });
  }

  const { data: prof } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", user.id)
    .single();
  const email = (prof as { email?: string | null } | null)?.email;
  if (email) {
    void sendKmgEmail({
      to: email,
      subject: "[KM Global] Tài khoản tạm khóa 3 ngày",
      html: tempLockEmailHtml(
        (prof as { full_name?: string | null })?.full_name ?? null,
        until.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      ),
    });
  }

  return NextResponse.json({
    success: true,
    selfTempLockUntil: until.toISOString(),
  });
}
