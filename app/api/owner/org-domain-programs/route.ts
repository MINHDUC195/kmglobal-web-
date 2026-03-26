/**
 * GET /api/owner/org-domain-programs
 * Danh sách chương trình + khóa học cơ bản (để chọn miễn phí theo domain).
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

async function ensureOwner() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "owner") return { ok: false as const };
  return { ok: true as const };
}

export async function GET() {
  const auth = await ensureOwner();
  if (!auth.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data: programs, error: pErr } = await admin
    .from("programs")
    .select("id, name, code")
    .order("name", { ascending: true });

  if (pErr) {
    console.error("org-domain-programs programs:", pErr);
    return NextResponse.json({ error: "Không tải được chương trình" }, { status: 500 });
  }

  const programIds = (programs ?? []).map((p) => p.id);
  const { data: bases } =
    programIds.length > 0
      ? await admin
          .from("base_courses")
          .select("id, program_id, name, code")
          .in("program_id", programIds)
          .order("name", { ascending: true })
      : { data: [] as { id: string; program_id: string; name: string; code: string }[] };

  const byProgram: Record<string, { id: string; name: string; code: string }[]> = {};
  for (const b of bases ?? []) {
    const pid = (b as { program_id: string }).program_id;
    if (!byProgram[pid]) byProgram[pid] = [];
    byProgram[pid].push({
      id: (b as { id: string }).id,
      name: (b as { name: string }).name,
      code: (b as { code: string }).code,
    });
  }

  return NextResponse.json({
    programs: (programs ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      base_courses: byProgram[p.id] ?? [],
    })),
  });
}
