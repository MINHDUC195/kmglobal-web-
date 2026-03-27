/**
 * POST /api/owner/whitelist-cohorts/[id]/bases
 * Body: { base_course_ids: string[] } — thay toàn bộ base gắn với đợt
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
  if (!user) return { ok: false as const, userId: "" };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "owner") return { ok: false as const, userId: "" };
  return { ok: true as const, userId: user.id };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const auth = await ensureOwner();
  if (!auth.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: cohortId } = await context.params;
  let body: { base_course_ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = Array.isArray(body.base_course_ids) ? body.base_course_ids : [];
  const baseIds = [...new Set(raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0))];

  const admin = getSupabaseAdminClient();

  const { data: cohort } = await admin.from("whitelist_cohorts").select("id").eq("id", cohortId).maybeSingle();
  if (!cohort) {
    return NextResponse.json({ error: "Không tìm thấy đợt" }, { status: 404 });
  }

  const { error: delErr } = await admin.from("whitelist_cohort_base_courses").delete().eq("cohort_id", cohortId);
  if (delErr) {
    console.error("whitelist bases delete:", delErr);
    return NextResponse.json({ error: "Không cập nhật được danh sách base" }, { status: 500 });
  }

  if (baseIds.length > 0) {
    const { error: insErr } = await admin.from("whitelist_cohort_base_courses").insert(
      baseIds.map((base_course_id) => ({ cohort_id: cohortId, base_course_id }))
    );
    if (insErr) {
      console.error("whitelist bases insert:", insErr);
      return NextResponse.json({ error: "Không gắn được khóa cơ bản (kiểm tra ID)" }, { status: 400 });
    }
  }

  await logAuditEvent({
    actorId: auth.userId,
    action: "owner.whitelist_cohort.bases",
    resourceType: "whitelist_cohort",
    resourceId: cohortId,
    metadata: { base_count: baseIds.length },
  });

  return NextResponse.json({ ok: true, base_course_ids: baseIds });
}
