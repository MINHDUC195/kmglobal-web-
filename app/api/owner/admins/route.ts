/**
 * GET /api/owner/admins - Danh sách admin
 * POST /api/owner/admins - Tạo admin mới
 * PATCH /api/owner/admins - Sửa thông tin admin
 * DELETE /api/owner/admins?userId=... - Xóa admin (owner không thể tự xóa)
 */

import { NextRequest, NextResponse } from "next/server";
import { validatePasswordStrength } from "@/lib/password-policy";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { logAuditEvent } from "../../../../lib/audit-log";

async function ensureOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, userId: "" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as { role?: string } | null)?.role !== "owner") {
    return { ok: false, status: 403, userId: "" };
  }
  return { ok: true, status: 200, userId: user.id };
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const auth = await ensureOwner(supabase);
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const admin = getSupabaseAdminClient();
  const { data: admins } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, company, id_card, can_edit_content, role, created_at")
    .in("role", ["owner", "admin"])
    .order("created_at", { ascending: false });

  const adminIds = (admins ?? []).map((a) => a.id);
  const { data: aep } = adminIds.length > 0
    ? await admin
        .from("admin_editable_programs")
        .select("user_id, program_id")
        .in("user_id", adminIds)
    : { data: [] as { user_id: string; program_id: string }[] };

  const editableByUser = (aep ?? []).reduce(
    (acc, row) => {
      const uid = row.user_id;
      if (!acc[uid]) acc[uid] = [] as string[];
      acc[uid].push(row.program_id);
      return acc;
    },
    {} as Record<string, string[]>
  );

  const adminsWithPrograms = (admins ?? []).map((a) => ({
    ...a,
    editable_program_ids: editableByUser[a.id] ?? [],
  }));

  return NextResponse.json({ admins: adminsWithPrograms, currentUserId: auth.userId });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const auth = await ensureOwner(supabase);
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  let body: {
    email?: string;
    password?: string;
    full_name?: string;
    phone?: string;
    company?: string;
    id_card?: string;
    editable_program_ids?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;
  const fullName = body.full_name?.trim() || body.company?.trim() || "";
  const phone = body.phone?.trim() || "";
  const company = body.company?.trim() || "";
  const idCard = body.id_card?.trim() || "";
  const editableProgramIds = Array.isArray(body.editable_program_ids)
    ? body.editable_program_ids.filter((id) => typeof id === "string" && id.trim())
    : [];

  if (!email) {
    return NextResponse.json({ error: "Email là bắt buộc" }, { status: 400 });
  }
  const pwCheck = validatePasswordStrength(password ?? "");
  if (!pwCheck.ok) {
    return NextResponse.json({ error: pwCheck.message ?? "Mật khẩu không đủ mạnh." }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!serviceRoleKey || serviceRoleKey.length < 20) {
    return NextResponse.json({
      error: "Thiếu cấu hình SUPABASE_SERVICE_ROLE_KEY. Kiểm tra .env.local (Supabase Dashboard → Settings → API → service_role)",
    }, { status: 500 });
  }

  const admin = getSupabaseAdminClient();

  // Redirect sau khi admin click link xác nhận: agree-terms → /admin
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
    || new URL(request.url).origin;
  const redirectTo = `${baseUrl.replace(/\/$/, "")}/auth/agree-terms?to=${encodeURIComponent("/admin")}`;

  /** GoTrue accepts `email_redirect_to` on admin create; not in Auth.js TS types */
  const createUserAttrs = Object.assign(
    {
      email,
      password,
      email_confirm: false as const,
      user_metadata: {
        full_name: fullName || company || email,
        role: "admin",
        company,
        phone,
      },
    },
    { email_redirect_to: redirectTo }
  );
  const { data: newUser, error: authError } = await admin.auth.admin.createUser(
    createUserAttrs as Parameters<typeof admin.auth.admin.createUser>[0]
  );

  if (authError) {
    let msg = authError.message || "Không tạo được tài khoản";
    if (msg.includes("User not allowed") || msg.includes("not allowed")) {
      msg = "Tạo tài khoản thất bại: User not allowed. Kiểm tra SUPABASE_SERVICE_ROLE_KEY trong .env.local (dùng service_role, không dùng anon key). Xem Supabase Dashboard → Settings → API.";
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (!newUser.user?.id) {
    return NextResponse.json({ error: "Tạo user thất bại" }, { status: 500 });
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      id_card: idCard || null,
      can_edit_content: editableProgramIds.length > 0,
      full_name: fullName || company || null,
      company: company || null,
      phone: phone || null,
      must_change_password: true,
    })
    .eq("id", newUser.user.id);

  if (updateError) {
    return NextResponse.json({
      error: "Tạo admin thành công nhưng cập nhật thông tin thất bại: " + updateError.message,
    }, { status: 500 });
  }

  if (editableProgramIds.length > 0) {
    await admin.from("admin_editable_programs").insert(
      editableProgramIds.map((program_id) => ({ user_id: newUser.user.id, program_id }))
    );
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.admin.create",
    resourceType: "profile",
    resourceId: newUser.user.id,
    metadata: { email },
  });

  return NextResponse.json({
    success: true,
    userId: newUser.user.id,
    email: newUser.user.email,
    requiresConfirmation: true,
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const auth = await ensureOwner(supabase);
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  let body: {
    userId?: string;
    full_name?: string;
    phone?: string;
    company?: string;
    id_card?: string;
    editable_program_ids?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId là bắt buộc" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (!target || !["owner", "admin"].includes((target as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "Không tìm thấy admin" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.full_name !== undefined) updates.full_name = body.full_name?.trim() || null;
  if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
  if (body.company !== undefined) updates.company = body.company?.trim() || null;
  if (body.id_card !== undefined) updates.id_card = body.id_card?.trim() || null;

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from("profiles").update(updates).eq("id", userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (body.editable_program_ids !== undefined) {
    const editableProgramIds = Array.isArray(body.editable_program_ids)
      ? body.editable_program_ids.filter((id) => typeof id === "string" && id.trim())
      : [];
    await admin.from("admin_editable_programs").delete().eq("user_id", userId);
    if (editableProgramIds.length > 0) {
      await admin.from("admin_editable_programs").insert(
        editableProgramIds.map((program_id) => ({ user_id: userId, program_id }))
      );
    }
    await admin
      .from("profiles")
      .update({ can_edit_content: editableProgramIds.length > 0 })
      .eq("id", userId);
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.admin.update",
    resourceType: "profile",
    resourceId: userId,
    metadata: {
      profileKeys: Object.keys(updates),
      programsUpdated: body.editable_program_ids !== undefined,
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const auth = await ensureOwner(supabase);
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const userId = request.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId là bắt buộc" }, { status: 400 });
  }

  if (userId === auth.userId) {
    return NextResponse.json({ error: "Owner không thể tự xóa chính mình" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
  }

  const role = (target as { role?: string }).role;
  if (role === "owner") {
    return NextResponse.json({ error: "Không thể xóa owner khác" }, { status: 403 });
  }
  if (role !== "admin") {
    return NextResponse.json({ error: "Chỉ có thể xóa admin" }, { status: 403 });
  }

  const { error: delError } = await admin.auth.admin.deleteUser(userId);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.admin.delete",
    resourceType: "auth_user",
    resourceId: userId,
  });

  return NextResponse.json({ success: true });
}
