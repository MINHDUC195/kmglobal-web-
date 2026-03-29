/**
 * PATCH /api/admin/regular-courses/[id]/approval — Admin/Owner: gửi lên chờ phê duyệt (draft → pending)
 */

import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../../lib/supabase-admin";
import { getStaffRole, isAdminOrOwner } from "../../../../../../lib/staff-auth";
import { validateOrigin } from "../../../../../../lib/csrf";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const supabase = await createServerSupabaseClient();
  const staff = await getStaffRole(supabase);
  if (!staff?.userId || !isAdminOrOwner(staff.role)) {
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

  if (body.action !== "submit") {
    return NextResponse.json({ error: "action phải là 'submit'" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: row } = await admin
    .from("regular_courses")
    .select("id, approval_status")
    .eq("id", id)
    .single();

  if (!row) return NextResponse.json({ error: "Không tìm thấy khóa học" }, { status: 404 });

  const status = (row as { approval_status?: string }).approval_status;
  if (status !== "draft") {
    return NextResponse.json(
      { error: "Chỉ có thể gửi phê duyệt khi khóa đang ở trạng thái nháp (bị từ chối trước đó)" },
      { status: 400 }
    );
  }

  const { error } = await admin
    .from("regular_courses")
    .update({ approval_status: "pending", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidateTag("catalog", "default");
  return NextResponse.json({ success: true });
}
