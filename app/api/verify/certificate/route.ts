/**
 * GET /api/verify/certificate?code=...
 * Tra cứu chứng chỉ theo mã. Công khai, không cần đăng nhập.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { maskEmail } from "../../../../lib/privacy";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../lib/rate-limit";

export async function GET(request: NextRequest) {
  const rl = await checkRateLimit(rateLimitKeyFromRequest(request, "cert-verify"), 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu. Thử lại sau." }, { status: 429 });
  }

  const code = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();

  if (!code || code.length < 5) {
    return NextResponse.json({ error: "Mã chứng chỉ không hợp lệ" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: cert, error } = await admin
    .from("certificates")
    .select("id, code, percent_score, issued_at, user_id, regular_course_id, base_course_id")
    .eq("code", code)
    .single();

  if (error || !cert) {
    return NextResponse.json({ error: "Không tìm thấy chứng chỉ" }, { status: 404 });
  }

  const [{ data: profile }, { data: rc }, { data: bc }] = await Promise.all([
    admin.from("profiles").select("full_name, email").eq("id", cert.user_id).single(),
    admin.from("regular_courses").select("name").eq("id", cert.regular_course_id).single(),
    admin.from("base_courses").select("name, code").eq("id", cert.base_course_id).single(),
  ]);

  const p = profile as { full_name?: string; email?: string } | null;
  const regularCourse = rc as { name?: string } | null;
  const baseCourse = bc as { name?: string; code?: string } | null;

  return NextResponse.json({
    code: cert.code,
    fullName: p?.full_name ?? "—",
    emailMasked: maskEmail(p?.email),
    courseName: regularCourse?.name ?? baseCourse?.name ?? "—",
    courseCode: baseCourse?.code ?? "—",
    percentScore: cert.percent_score,
    issuedAt: cert.issued_at,
  });
}
