/**
 * POST /api/owner/students/[userId]/unlock-abuse
 * Owner mở khóa tài khoản bị khóa do abuse (hủy đăng ký lần 5 chưa thanh toán).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../../lib/supabase-admin";
import { logAuditEvent } from "../../../../../../lib/audit-log";
import { validateOrigin } from "../../../../../../lib/csrf";

async function ensureOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return (profile as { role?: string } | null)?.role === "owner";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  const isOwner = await ensureOwner(supabase);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "Thiếu userId" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      account_abuse_locked: false,
      abuse_locked_at: null,
    })
    .eq("id", userId);

  if (error) {
    console.error("unlock-abuse:", error);
    return NextResponse.json({ error: "Không thể mở khóa" }, { status: 500 });
  }

  const {
    data: { user: ownerUser },
  } = await supabase.auth.getUser();
  if (ownerUser?.id) {
    await logAuditEvent({
      actorId: ownerUser.id,
      action: "owner.student.unlock_abuse",
      resourceType: "profile",
      resourceId: userId,
    });
  }

  return NextResponse.json({ success: true });
}
