/**
 * POST /api/cron/org-domain-expiry
 * Thu hồi tự động entitlement chưa dùng quá hạn (phương án A).
 * Bảo vệ: header Authorization: Bearer CRON_SECRET hoặc ?secret=
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { revokeExpiredUnusedOrgDomainEntitlements } from "@/lib/org-domain";

function authorize(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || "";
  if (!secret || secret.length < 8) return false;
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const q = request.nextUrl.searchParams.get("secret");
  return bearer === secret || q === secret;
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = getSupabaseAdminClient();
  const n = await revokeExpiredUnusedOrgDomainEntitlements(admin);
  return NextResponse.json({ revoked: n });
}
