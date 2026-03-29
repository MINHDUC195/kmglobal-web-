/**
 * POST /api/owner/students/promote-confirm
 * Hoàn tất nâng học viên lên admin sau khi Owner bấm liên kết trong email (token một lần).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { logAuditEvent } from "../../../../../lib/audit-log";
import { validateOrigin } from "@/lib/csrf";
import { hashAdminPromotionToken } from "../../../../../lib/admin-promotion-token";

async function ensureOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, userId: "" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "owner") {
    return { ok: false as const, status: 403, userId: "" };
  }
  return { ok: true as const, status: 200, userId: user.id };
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  const auth = await ensureOwner(supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: auth.status });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Thiếu token" }, { status: 400 });
  }

  const tokenHash = hashAdminPromotionToken(token);
  const admin = getSupabaseAdminClient();

  const { data: row, error: fetchErr } = await admin
    .from("admin_promotion_requests")
    .select("id, candidate_user_id, requested_by, expires_at, consumed_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json(
      { error: "Liên kết không hợp lệ hoặc đã được sử dụng." },
      { status: 400 }
    );
  }

  const reqRow = row as {
    id: string;
    candidate_user_id: string;
    requested_by: string;
    expires_at: string;
    consumed_at: string | null;
  };

  if (reqRow.consumed_at) {
    return NextResponse.json({ error: "Liên kết đã được sử dụng." }, { status: 400 });
  }

  if (new Date(reqRow.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Liên kết đã hết hạn. Vui lòng gửi yêu cầu mới từ trang học viên." }, { status: 400 });
  }

  if (reqRow.requested_by !== auth.userId) {
    return NextResponse.json(
      { error: "Chỉ Owner đã gửi yêu cầu mới có thể xác nhận. Đăng nhập đúng tài khoản Owner." },
      { status: 403 }
    );
  }

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", reqRow.candidate_user_id)
    .single();

  if (pErr || !profile) {
    return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
  }

  const role = (profile as { role?: string }).role;
  if (role === "owner") {
    return NextResponse.json({ error: "Không thể thay đổi vai trò owner" }, { status: 403 });
  }
  if (role === "admin") {
    await admin.from("admin_promotion_requests").update({ consumed_at: new Date().toISOString() }).eq("id", reqRow.id);
    return NextResponse.json({ error: "Người này đã là admin" }, { status: 400 });
  }

  const { error: updErr } = await admin
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", reqRow.candidate_user_id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await admin
    .from("admin_promotion_requests")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", reqRow.id);

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.student.promote_to_admin",
    resourceType: "profile",
    resourceId: reqRow.candidate_user_id,
    metadata: { via_email_token: true, request_id: reqRow.id },
  });

  return NextResponse.json({ success: true });
}
