/**
 * GET /api/owner/students
 * Danh sách học viên (role=student), gán mã tự động theo thứ tự tham gia.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { logAuditEvent } from "../../../../lib/audit-log";

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

  // Học viên: role='student' HOẶC không phải owner/admin (bao gồm role null từ dữ liệu cũ)
  let allProfiles: { id: string; full_name?: string | null; email?: string | null; phone?: string | null; company?: string | null; address?: string | null; gender?: string | null; student_code?: string | null; created_at?: string | null; role?: string | null }[] = [];

  const res1 = await admin
    .from("profiles")
    .select("id, full_name, email, phone, company, address, gender, student_code, created_at, role")
    .order("created_at", { ascending: true });

  if (res1.error) {
    if (res1.error.message?.includes("student_code")) {
      const res2 = await admin
        .from("profiles")
        .select("id, full_name, email, phone, company, address, gender, created_at, role")
        .order("created_at", { ascending: true });
      if (!res2.error) {
        allProfiles = (res2.data ?? []).map((r) => ({ ...r, student_code: null }));
      } else {
        return NextResponse.json({ error: res2.error.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: res1.error.message }, { status: 500 });
    }
  } else {
    allProfiles = res1.data ?? [];
  }

  const students = (allProfiles ?? []).filter(
    (p) =>
      p.role === "student" ||
      (p.role !== "owner" && p.role !== "admin")
  );

  if (!students || students.length === 0) {
    return NextResponse.json({ students: [] });
  }

  // Assign student_code for those missing (theo thứ tự created_at)
  const needCode = students.filter((s) => !(s as { student_code?: string }).student_code);
  for (const s of needCode) {
    try {
      const { data: code, error } = await admin.rpc("next_student_code");
      if (!error && code) {
        await admin
          .from("profiles")
          .update({ student_code: code })
          .eq("id", s.id);
        (s as { student_code?: string }).student_code = code;
      }
    } catch {
      // Bỏ qua nếu RPC lỗi (migration chưa chạy)
    }
  }

  const studentIds = students.map((s) => s.id);

  const { data: enrollments } = await admin
    .from("enrollments")
    .select("user_id, regular_course_id, payment_id")
    .in("user_id", studentIds);

  const courseIds = [...new Set((enrollments ?? []).map((e) => e.regular_course_id).filter(Boolean))] as string[];
  const { data: courses } = courseIds.length > 0
    ? await admin.from("regular_courses").select("id, name").in("id", courseIds)
    : { data: [] as { id: string; name: string }[] };
  const courseMap = new Map((courses ?? []).map((c) => [c.id, c.name]));

  const paymentIds = [...new Set((enrollments ?? []).map((e) => e.payment_id).filter(Boolean))] as string[];
  const { data: payments } = paymentIds.length > 0
    ? await admin.from("payments").select("id, status").in("id", paymentIds)
    : { data: [] as { id: string; status: string }[] };
  const paidIds = new Set(
    (payments ?? []).filter((p) => p.status === "completed").map((p) => p.id)
  );

  const enrollByUser = (enrollments ?? []).reduce(
    (acc, e) => {
      const uid = e.user_id;
      if (!acc[uid]) acc[uid] = [];
      const name = courseMap.get(e.regular_course_id) ?? "—";
      const isPaid = e.payment_id && paidIds.has(e.payment_id);
      acc[uid].push({ course: name, paid: isPaid });
      return acc;
    },
    {} as Record<string, { course: string; paid: boolean }[]>
  );

  const list = students.map((s) => {
    const items = enrollByUser[s.id] ?? [];
    const courseNames = [...new Set(items.map((i) => i.course))].filter((c) => c !== "—");
    const hasPaid = items.some((i) => i.paid);
    const hasEnrollment = items.length > 0;
    let paymentStatus: string;
    if (!hasEnrollment) paymentStatus = "Chưa đăng ký";
    else if (hasPaid) paymentStatus = "Thanh toán";
    else paymentStatus = "Học thử";

    return {
      id: s.id,
      student_code: (s as { student_code?: string }).student_code ?? "—",
      full_name: s.full_name ?? "—",
      email: s.email ?? "—",
      phone: s.phone ?? "—",
      company: s.company ?? "—",
      address: s.address ?? "—",
      gender: s.gender === "male" ? "Nam" : s.gender === "female" ? "Nữ" : s.gender ?? "—",
      created_at: s.created_at,
      enrolled_courses: courseNames,
      payment_status: paymentStatus,
    };
  });

  return NextResponse.json({ students: list });
}

/**
 * PATCH /api/owner/students
 * Body: { userId: string, action: "promote_to_admin" } — Owner phê duyệt nâng học viên lên admin.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const isOwner = await ensureOwner(supabase);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { userId?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "promote_to_admin") {
    return NextResponse.json({ error: "action không hợp lệ" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "Thiếu userId" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (fetchErr || !profile) {
    return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
  }

  const role = (profile as { role?: string }).role;
  if (role === "owner") {
    return NextResponse.json({ error: "Không thể thay đổi vai trò owner" }, { status: 403 });
  }
  if (role === "admin") {
    return NextResponse.json({ error: "Người này đã là admin" }, { status: 400 });
  }

  const { error: updErr } = await admin
    .from("profiles")
    .update({ role: "admin", updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  const {
    data: { user: ownerUser },
  } = await supabase.auth.getUser();
  if (ownerUser?.id) {
    await logAuditEvent({
      actorId: ownerUser.id,
      action: "owner.student.promote_to_admin",
      resourceType: "profile",
      resourceId: userId,
    });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/owner/students?userId=...
 * Xóa học viên hoàn toàn khỏi hệ thống (auth.users + profiles + enrollments cascade).
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const isOwner = await ensureOwner(supabase);
  if (!isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = request.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId là bắt buộc" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Không tìm thấy học viên" }, { status: 404 });
  }

  const role = (profile as { role?: string }).role;
  if (role === "owner" || role === "admin") {
    return NextResponse.json(
      { error: "Chỉ có thể xóa học viên. Dùng trang Quản lý Admin để xóa admin." },
      { status: 403 }
    );
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const {
    data: { user: ownerUser },
  } = await supabase.auth.getUser();
  if (ownerUser?.id) {
    await logAuditEvent({
      actorId: ownerUser.id,
      action: "owner.student.delete",
      resourceType: "auth_user",
      resourceId: userId,
    });
  }

  return NextResponse.json({ success: true });
}
