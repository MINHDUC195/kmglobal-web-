/**
 * Edit locks API — Pessimistic locking cho lesson/chapter
 * POST: acquire (hoặc extend nếu cùng user)
 * PATCH: extend/heartbeat
 * DELETE: release
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getStaffRole, isAdminOrOwner } from "../../../../lib/staff-auth";
import { validateOrigin } from "../../../../lib/csrf";

const LOCK_TTL_MINUTES = 30;
const VALID_TYPES = ["lesson", "chapter"] as const;

type ResourceType = (typeof VALID_TYPES)[number];

function isValidType(s: unknown): s is ResourceType {
  return typeof s === "string" && VALID_TYPES.includes(s as ResourceType);
}

function parseBody(body: unknown): { resource_type: ResourceType; resource_id: string } | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const type = o.resource_type;
  const id = o.resource_id;
  if (!isValidType(type) || typeof id !== "string" || !id.trim()) return null;
  return { resource_type: type, resource_id: id.trim() };
}

function newExpiresAt(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + LOCK_TTL_MINUTES);
  return d.toISOString();
}

export async function POST(req: NextRequest) {
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  const staff = await getStaffRole(supabase);
  if (!staff || !isAdminOrOwner(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "resource_type (lesson|chapter) và resource_id bắt buộc" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();

  // 1. Xóa lock hết hạn
  await admin
    .from("edit_locks")
    .delete()
    .eq("resource_type", parsed.resource_type)
    .eq("resource_id", parsed.resource_id)
    .lt("expires_at", new Date().toISOString());

  // 2. Lấy lock hiện tại (nếu còn)
  const { data: existing } = await admin
    .from("edit_locks")
    .select("locked_by, locked_at, expires_at")
    .eq("resource_type", parsed.resource_type)
    .eq("resource_id", parsed.resource_id)
    .maybeSingle();

  if (existing) {
    if ((existing as { locked_by: string }).locked_by !== staff.userId) {
      // Bị người khác khóa → lấy tên
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", (existing as { locked_by: string }).locked_by)
        .single();
      const lockedByName =
        (profile as { full_name?: string | null } | null)?.full_name?.trim() || "Người khác";
      return NextResponse.json(
        {
          error: "LOCKED_BY_OTHER",
          locked_by_name: lockedByName,
          expires_at: (existing as { expires_at: string }).expires_at,
        },
        { status: 409 }
      );
    }
    // Cùng user → extend
    const expiresAt = newExpiresAt();
    await admin
      .from("edit_locks")
      .update({ expires_at: expiresAt })
      .eq("resource_type", parsed.resource_type)
      .eq("resource_id", parsed.resource_id)
      .eq("locked_by", staff.userId);
    return NextResponse.json({ ok: true, expires_at: expiresAt });
  }

  // 3. Không có lock → insert
  const expiresAt = newExpiresAt();
  const { error: insErr } = await admin.from("edit_locks").insert({
    resource_type: parsed.resource_type,
    resource_id: parsed.resource_id,
    locked_by: staff.userId,
    locked_at: new Date().toISOString(),
    expires_at: expiresAt,
  });

  if (insErr) {
    // Race: có thể user khác vừa insert → kiểm tra lại
    const { data: again } = await admin
      .from("edit_locks")
      .select("locked_by")
      .eq("resource_type", parsed.resource_type)
      .eq("resource_id", parsed.resource_id)
      .maybeSingle();
    if (again && (again as { locked_by: string }).locked_by !== staff.userId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", (again as { locked_by: string }).locked_by)
        .single();
      const lockedByName =
        (profile as { full_name?: string | null } | null)?.full_name?.trim() || "Người khác";
      return NextResponse.json(
        { error: "LOCKED_BY_OTHER", locked_by_name: lockedByName, expires_at: expiresAt },
        { status: 409 }
      );
    }
    if ((again as { locked_by: string } | null)?.locked_by === staff.userId) {
      return NextResponse.json({ ok: true, expires_at: expiresAt });
    }
    console.error("edit_locks insert:", insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expires_at: expiresAt });
}

export async function PATCH(req: NextRequest) {
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  const staff = await getStaffRole(supabase);
  if (!staff || !isAdminOrOwner(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "resource_type (lesson|chapter) và resource_id bắt buộc" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();
  const expiresAt = newExpiresAt();

  const { data, error } = await admin
    .from("edit_locks")
    .update({ expires_at: expiresAt })
    .eq("resource_type", parsed.resource_type)
    .eq("resource_id", parsed.resource_id)
    .eq("locked_by", staff.userId)
    .select("locked_by")
    .maybeSingle();

  if (error) {
    console.error("edit_locks PATCH:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Lock không tồn tại hoặc đã hết hạn" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, expires_at: expiresAt });
}

export async function DELETE(req: NextRequest) {
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  const staff = await getStaffRole(supabase);
  if (!staff || !isAdminOrOwner(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "resource_type (lesson|chapter) và resource_id bắt buộc" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();
  await admin
    .from("edit_locks")
    .delete()
    .eq("resource_type", parsed.resource_type)
    .eq("resource_id", parsed.resource_id)
    .eq("locked_by", staff.userId);

  return NextResponse.json({ ok: true });
}
