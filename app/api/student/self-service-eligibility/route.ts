/**
 * GET — Cho UI biết user có được tự đăng ký / thanh toán khóa qua cổng học viên không.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { isRoleBlockedFromSelfServiceEnrollment } from "../../../../lib/self-service-enrollment";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ allowed: true, authenticated: false });
  }

  const admin = getSupabaseAdminClient();
  const { data: row } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const role = (row as { role?: string } | null)?.role;
  const blocked = isRoleBlockedFromSelfServiceEnrollment(role);

  return NextResponse.json({
    authenticated: true,
    allowed: !blocked,
    role: role ?? null,
  });
}
