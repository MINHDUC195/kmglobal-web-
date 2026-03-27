/**
 * GET /api/owner/whitelist-cohorts — danh sách đợt whitelist
 * POST /api/owner/whitelist-cohorts — tạo đợt mới
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateOrigin } from "@/lib/csrf";
import { logAuditEvent } from "@/lib/audit-log";

async function ensureOwner() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401 as const, userId: "" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "owner") {
    return { ok: false as const, status: 403 as const, userId: "" };
  }
  return { ok: true as const, status: 200 as const, userId: user.id };
}

export async function GET() {
  const auth = await ensureOwner();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  const admin = getSupabaseAdminClient();
  const { data: cohorts, error } = await admin
    .from("whitelist_cohorts")
    .select("id, name, status, notes, applies_from, applies_until, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("whitelist_cohorts list:", error);
    return NextResponse.json({ error: "Không tải được danh sách đợt whitelist" }, { status: 500 });
  }

  const ids = (cohorts ?? []).map((c) => (c as { id: string }).id);
  let memberCounts: Record<string, number> = {};
  let baseCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: members } = await admin.from("whitelist_members").select("cohort_id").in("cohort_id", ids);
    for (const m of members ?? []) {
      const cid = (m as { cohort_id: string }).cohort_id;
      memberCounts[cid] = (memberCounts[cid] ?? 0) + 1;
    }
    const { data: bases } = await admin.from("whitelist_cohort_base_courses").select("cohort_id").in("cohort_id", ids);
    for (const b of bases ?? []) {
      const cid = (b as { cohort_id: string }).cohort_id;
      baseCounts[cid] = (baseCounts[cid] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    cohorts: (cohorts ?? []).map((c) => {
      const row = c as {
        id: string;
        name: string;
        status: string;
        notes: string | null;
        applies_from: string | null;
        applies_until: string | null;
        created_at: string;
        updated_at: string;
      };
      return {
        ...row,
        member_count: memberCounts[row.id] ?? 0,
        base_count: baseCounts[row.id] ?? 0,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const auth = await ensureOwner();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: auth.status });

  let body: {
    name?: string;
    notes?: string | null;
    status?: string;
    applies_from?: string | null;
    applies_until?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Tên đợt là bắt buộc" }, { status: 400 });
  }
  const status = body.status === "active" || body.status === "archived" ? body.status : "draft";
  const notes = body.notes?.trim() || null;
  const appliesFrom =
    typeof body.applies_from === "string" && body.applies_from.trim()
      ? body.applies_from.trim()
      : null;
  const appliesUntil =
    typeof body.applies_until === "string" && body.applies_until.trim()
      ? body.applies_until.trim()
      : null;

  const admin = getSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("whitelist_cohorts")
    .insert({
      name,
      notes,
      status,
      created_by: auth.userId,
      applies_from: appliesFrom,
      applies_until: appliesUntil,
    })
    .select("id, name, status, notes, applies_from, applies_until, created_at, updated_at")
    .single();

  if (error || !row) {
    console.error("whitelist_cohorts insert:", error);
    return NextResponse.json({ error: "Không tạo được đợt whitelist" }, { status: 500 });
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.whitelist_cohort.create",
    resourceType: "whitelist_cohort",
    resourceId: (row as { id: string }).id,
    metadata: { name },
  });

  return NextResponse.json({ cohort: row });
}
