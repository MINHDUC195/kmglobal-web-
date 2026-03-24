/**
 * GET /api/owner/reports/payments
 * Danh sách hoạt động thanh toán (đăng ký khóa học) cho Owner báo cáo.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";

async function ensureOwner(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return (profile as { role?: string } | null)?.role === "owner";
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const isOwner = await ensureOwner(supabase);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();

  // Lấy payments có course (qua metadata hoặc enrollment), join profiles, enrollments, regular_courses
  const { data: payments } = await admin
    .from("payments")
    .select("id, user_id, amount_cents, status, gateway_transaction_id, invoice_exported_at, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(500);

  if (!payments || payments.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const userIds = [...new Set(payments.map((p) => p.user_id).filter(Boolean))] as string[];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("id, user_id, regular_course_id, payment_id, status")
    .in("payment_id", payments.map((p) => p.id));

  const enrollmentByPayment = new Map((enrollments ?? []).map((e) => [e.payment_id, e]));

  const courseIds = [...new Set((enrollments ?? []).map((e) => e.regular_course_id).filter(Boolean))] as string[];
  const { data: courses } = courseIds.length > 0
    ? await admin
        .from("regular_courses")
        .select("id, name")
        .in("id", courseIds)
    : { data: [] as { id: string; name: string }[] };

  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]));

  const items = payments.map((p) => {
    const enrollment = enrollmentByPayment.get(p.id);
    const courseId = enrollment?.regular_course_id ?? (p.metadata as { course_id?: string } | null)?.course_id;
    const course = courseId ? courseMap.get(courseId) : null;
    const profile = p.user_id ? profileMap.get(p.user_id) : null;

    return {
      id: p.id,
      course_name: course?.name ?? "—",
      management_code: p.gateway_transaction_id || p.id.slice(0, 8),
      student_name: profile?.full_name || profile?.email || "—",
      student_code: profile?.email ?? p.user_id?.slice(0, 8) ?? "—",
      status: p.status === "completed" ? "Đã thanh toán" : enrollment ? "Đã đăng ký" : p.status === "pending" ? "Chờ thanh toán" : p.status,
      amount_cents: p.amount_cents,
      amount_display: formatVnd(Number(p.amount_cents)),
      invoice_exported_at: p.invoice_exported_at,
    };
  });

  return NextResponse.json({ items });
}

function formatVnd(cents: number): string {
  if (cents === 0) return "0 ₫";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(cents);
}
