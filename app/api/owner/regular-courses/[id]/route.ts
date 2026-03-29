/**
 * PATCH /api/owner/regular-courses/[id] — Phê duyệt / từ chối hiển thị khóa học thường
 */

import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../../lib/csrf";

async function ensureOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return (profile as { role?: string } | null)?.role === "owner";
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  if (!(await ensureOwner(supabase))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "action phải là 'approve' hoặc 'reject'" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: row } = await admin
    .from("regular_courses")
    .select("id, approval_status")
    .eq("id", id)
    .single();

  if (!row) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });

  const status = (row as { approval_status?: string }).approval_status;
  if (status !== "pending") {
    return NextResponse.json(
      { error: "Chỉ có thể phê duyệt/từ chối khóa đang ở trạng thái chờ phê duyệt" },
      { status: 400 }
    );
  }

  const newStatus = action === "approve" ? "approved" : "draft";
  const { error } = await admin
    .from("regular_courses")
    .update({ approval_status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidateTag("catalog", "default");
  return NextResponse.json({ success: true });
}
