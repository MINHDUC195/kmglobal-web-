/**
 * GET /api/owner/students/[userId]
 * Chi tiết học viên: profile, enrollments (khóa đã đăng ký), certificates
 */

import { NextRequest, NextResponse } from "next/server";
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const isOwner = await ensureOwner(supabase);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "userId là bắt buộc" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id, full_name, email, phone, company, address, gender, student_code, created_at")
    .eq("id", userId)
    .single();

  if (pErr || !profile) {
    return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  }

  const p = profile as {
    id: string;
    full_name?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    address?: string | null;
    gender?: string | null;
    student_code?: string | null;
    created_at?: string | null;
  };

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("id, enrolled_at, status, regular_course_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("enrolled_at", { ascending: false });

  const courseIds = [...new Set((enrollments ?? []).map((e) => e.regular_course_id).filter(Boolean))] as string[];
  const { data: courses } = courseIds.length > 0
    ? await admin.from("regular_courses").select("id, name").in("id", courseIds)
    : { data: [] as { id: string; name: string }[] };
  const courseMap = new Map((courses ?? []).map((c) => [c.id, c.name]));

  const enrollmentList = (enrollments ?? []).map((e) => ({
    id: e.id,
    courseName: courseMap.get(e.regular_course_id) ?? "—",
    enrolledAt: e.enrolled_at,
  }));

  const { data: certificates } = await admin
    .from("certificates")
    .select("id, code, percent_score, issued_at, regular_course_id")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });

  const rcIds = [...new Set((certificates ?? []).map((c) => c.regular_course_id).filter(Boolean))] as string[];
  const { data: certCourses } = rcIds.length > 0
    ? await admin.from("regular_courses").select("id, name").in("id", rcIds)
    : { data: [] as { id: string; name: string }[] };
  const certCourseMap = new Map((certCourses ?? []).map((c) => [c.id, c.name]));

  const certList = (certificates ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    percentScore: c.percent_score,
    issuedAt: c.issued_at,
    courseName: certCourseMap.get(c.regular_course_id) ?? "—",
  }));

  return NextResponse.json({
    profile: {
      id: p.id,
      studentCode: p.student_code ?? null,
      fullName: p.full_name ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      company: p.company ?? null,
      address: p.address ?? null,
      gender: p.gender === "male" ? "Nam" : p.gender === "female" ? "Nữ" : p.gender ?? null,
      createdAt: p.created_at,
    },
    enrollments: enrollmentList,
    certificates: certList,
  });
}
