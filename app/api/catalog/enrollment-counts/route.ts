import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

/** GET ?ids=uuid,uuid — trả active_enrollment_count (nhẹ, không COUNT). */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("ids");
  if (!raw?.trim()) {
    return NextResponse.json({ counts: [] as { id: string; active_enrollment_count: number }[] });
  }
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s))
    .slice(0, 40);
  if (!ids.length) {
    return NextResponse.json({ counts: [] });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("regular_courses")
    .select("id, active_enrollment_count")
    .in("id", ids)
    .eq("approval_status", "approved");

  if (error) {
    console.error("enrollment-counts:", error.message);
    return NextResponse.json({ error: "Không tải được số liệu" }, { status: 500 });
  }

  const counts = (data ?? []).map((row) => ({
    id: (row as { id: string }).id,
    active_enrollment_count: Number((row as { active_enrollment_count?: number }).active_enrollment_count) || 0,
  }));

  return NextResponse.json({ counts });
}
