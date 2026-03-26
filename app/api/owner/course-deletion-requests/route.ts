/**
 * GET /api/owner/course-deletion-requests — Yêu cầu xóa đang chờ (owner)
 * Dùng truy vấn tách để tránh lỗi embed phức tạp với PostgREST.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getStaffRole, isOwner } from "../../../../lib/staff-auth";
import {
  clampPage,
  parsePageParam,
  parsePageSizeParam,
  totalPagesFromCount,
} from "../../../../lib/list-pagination";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const staff = await getStaffRole(supabase);
  if (!staff?.userId || !isOwner(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClient();

  const { data: rows, error } = await admin
    .from("course_deletion_requests")
    .select("id, reason, created_at, regular_course_id, requested_by")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("course_deletion_requests list:", error);
    return NextResponse.json({ error: "Không tải được danh sách" }, { status: 500 });
  }

  const list = rows ?? [];
  const requesterIds = [...new Set(list.map((r) => (r as { requested_by: string }).requested_by))];
  const courseIds = [...new Set(list.map((r) => (r as { regular_course_id: string }).regular_course_id))];

  const [profilesRes, coursesRes] = await Promise.all([
    requesterIds.length > 0
      ? admin.from("profiles").select("id, email").in("id", requesterIds)
      : { data: [] as { id: string; email: string | null }[], error: null },
    courseIds.length > 0
      ? admin
          .from("regular_courses")
          .select(
            "id, name, registration_open_at, registration_close_at, course_start_at, course_end_at, program_id, base_course_id"
          )
          .in("id", courseIds)
      : { data: [] as unknown[], error: null },
  ]);

  const emailById: Record<string, string> = {};
  for (const p of profilesRes.data ?? []) {
    const row = p as { id: string; email: string | null };
    if (row.email) emailById[row.id] = row.email;
  }

  const courses = (coursesRes.data ?? []) as {
    id: string;
    name: string;
    registration_open_at: string | null;
    registration_close_at: string | null;
    course_start_at: string | null;
    course_end_at: string | null;
    program_id: string | null;
    base_course_id: string | null;
  }[];

  const programIds = [...new Set(courses.map((c) => c.program_id).filter(Boolean))] as string[];
  const baseCourseIds = [...new Set(courses.map((c) => c.base_course_id).filter(Boolean))] as string[];

  const [programsRes, baseCoursesRes] = await Promise.all([
    programIds.length > 0 ? admin.from("programs").select("id, name").in("id", programIds) : { data: [] as { id: string; name: string }[], error: null },
    baseCourseIds.length > 0 ? admin.from("base_courses").select("id, name, code").in("id", baseCourseIds) : { data: [] as { id: string; name: string; code: string }[], error: null },
  ]);

  const programMap = new Map<string, { name: string }>();
  for (const p of programsRes.data ?? []) {
    programMap.set((p as { id: string }).id, { name: (p as { name: string }).name });
  }
  const baseCourseMap = new Map<string, { name: string; code: string }>();
  for (const b of baseCoursesRes.data ?? []) {
    const row = b as { id: string; name: string; code: string };
    baseCourseMap.set(row.id, { name: row.name, code: row.code });
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));
  const requests = list.map((r) => {
    const row = r as {
      id: string;
      reason: string | null;
      created_at: string;
      regular_course_id: string;
      requested_by: string;
    };
    const rc = courseById.get(row.regular_course_id);
    return {
      id: row.id,
      reason: row.reason,
      created_at: row.created_at,
      requested_by: row.requested_by,
      requester_email: emailById[row.requested_by] ?? null,
      regular_course: rc
        ? {
            id: rc.id,
            name: rc.name,
            registration_open_at: rc.registration_open_at,
            registration_close_at: rc.registration_close_at,
            course_start_at: rc.course_start_at,
            course_end_at: rc.course_end_at,
            program: rc.program_id ? programMap.get(rc.program_id) ?? null : null,
            base_course: rc.base_course_id ? baseCourseMap.get(rc.base_course_id) ?? null : null,
          }
        : null,
    };
  });

  const page = parsePageParam(request.nextUrl.searchParams.get("page"));
  const pageSize = parsePageSizeParam(request.nextUrl.searchParams.get("pageSize"), 100);
  const total = requests.length;
  const totalPages = totalPagesFromCount(total, pageSize);
  const currentPage = clampPage(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const paged = requests.slice(start, start + pageSize);

  return NextResponse.json({
    requests: paged,
    meta: {
      total,
      page: currentPage,
      pageSize,
      totalPages,
    },
  });
}
