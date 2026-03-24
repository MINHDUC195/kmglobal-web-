/**
 * GET/PUT legal page content (owner only).
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { logAuditEvent } from "../../../../lib/audit-log";

const SLUGS = ["terms-of-service", "privacy-policy"] as const;
type LegalSlug = (typeof SLUGS)[number];

async function ensureOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, user: null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "owner") return { ok: false as const, user: null };
  return { ok: true as const, user };
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const auth = await ensureOwner(supabase);
  if (!auth.ok || !auth.user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = getSupabaseAdminClient();
  const { data: rows, error } = await admin
    .from("legal_pages")
    .select("slug, intro, body, updated_at")
    .in("slug", [...SLUGS])
    .order("slug");

  if (error) {
    console.error("legal_pages GET:", error);
    return NextResponse.json({ error: "Không tải được nội dung" }, { status: 500 });
  }

  const bySlug = Object.fromEntries((rows ?? []).map((r) => [r.slug, r])) as Record<
    LegalSlug,
    { slug: string; intro: string | null; body: string; updated_at: string }
  >;

  return NextResponse.json({ pages: bySlug });
}

type PageInput = { intro?: string | null; body?: string };

export async function PUT(req: Request) {
  const supabase = await createServerSupabaseClient();
  const auth = await ensureOwner(supabase);
  if (!auth.ok || !auth.user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = bodyJson as Record<string, PageInput>;
  const admin = getSupabaseAdminClient();

  for (const slug of SLUGS) {
    const page = input[slug];
    if (!page) continue;
    const intro = page.intro === undefined ? undefined : page.intro;
    const body = page.body;
    if (body !== undefined && typeof body !== "string") {
      return NextResponse.json({ error: `body cho ${slug} phải là chuỗi` }, { status: 400 });
    }
    if (intro !== undefined && intro !== null && typeof intro !== "string") {
      return NextResponse.json({ error: `intro cho ${slug} phải là chuỗi hoặc null` }, { status: 400 });
    }

    const patch: { intro?: string | null; body?: string; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (intro !== undefined) patch.intro = intro;
    if (body !== undefined) patch.body = body;

    const { error } = await admin.from("legal_pages").update(patch).eq("slug", slug);
    if (error) {
      console.error("legal_pages update:", error);
      return NextResponse.json({ error: "Lưu thất bại" }, { status: 500 });
    }
  }

  await logAuditEvent({
    actorId: auth.user.id,
    action: "legal_pages.update",
    resourceType: "legal_pages",
    metadata: { slugs: Object.keys(input).filter((k) => SLUGS.includes(k as LegalSlug)) },
  });

  return NextResponse.json({ ok: true });
}
