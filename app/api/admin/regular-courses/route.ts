/**
 * GET /api/admin/regular-courses — Danh sách khóa học thường + số HV + trạng thái (admin/owner)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getCourseDisplayStatus } from "../../../../lib/course-status";
import { getStaffRole, isAdminOrOwner } from "../../../../lib/staff-auth";
import { isCourseInLearningPeriod, type RegularCourseListFilter } from "../../../../lib/course-lifecycle";
import {
  clampPage,
  parsePageParam,
  parsePageSizeParam,
  totalPagesFromCount,
} from "../../../../lib/list-pagination";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const staff = await getStaffRole(supabase);
  if (!staff || !isAdminOrOwner(staff.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const filter = (request.nextUrl.searchParams.get("filter") ?? "all") as RegularCourseListFilter;
  const page = parsePageParam(request.nextUrl.searchParams.get("page"));
  const pageSize = parsePageSizeParam(request.nextUrl.searchParams.get("pageSize"), 100);
  const validFilter: RegularCourseListFilter = ["all", "registration", "learning", "ended"].includes(filter)
    ? filter
    : "all";

  const admin = getSupabaseAdminClient();

  const { data: courses, error: coursesError } = await admin
    .from("regular_courses")
    .select(
      `
      id,
      name,
      status,
      price_cents,
      registration_open_at,
      registration_close_at,
      course_start_at,
      course_end_at,
      created_at,
      program:programs(id, name),
      base_course:base_courses(id, name, code)
    `
    )
    .order("created_at", { ascending: false });

  if (coursesError) {
    console.error("regular_courses list:", coursesError);
    return NextResponse.json({ error: "Không tải được danh sách" }, { status: 500 });
  }

  const courseRows = courses ?? [];
  const ids = courseRows.map((c) => c.id);
  if (ids.length === 0) {
    return NextResponse.json({ courses: [] });
  }

  const { data: enrollAgg } = await admin
    .from("enrollments")
    .select("regular_course_id")
    .in("regular_course_id", ids)
    .eq("status", "active");

  const countByCourse: Record<string, number> = {};
  for (const row of enrollAgg ?? []) {
    const rid = (row as { regular_course_id: string }).regular_course_id;
    countByCourse[rid] = (countByCourse[rid] ?? 0) + 1;
  }

  const pendingByCourse: Record<string, string> = {};
  const { data: pendingReqs, error: pendingErr } = await admin
    .from("course_deletion_requests")
    .select("id, regular_course_id")
    .eq("status", "pending")
    .in("regular_course_id", ids);

  if (pendingErr) {
    console.warn("course_deletion_requests (chạy migration nếu thiếu bảng):", pendingErr.message);
  } else {
    for (const r of pendingReqs ?? []) {
      const row = r as { id: string; regular_course_id: string };
      pendingByCourse[row.regular_course_id] = row.id;
    }
  }

  const now = new Date();
  const mapped = courseRows
    .map((c) => {
      const ro = c.registration_open_at as string | null;
      const rc = c.registration_close_at as string | null;
      const ce = c.course_end_at as string | null;
      const cs = c.course_start_at as string | null;
      const displayStatus = getCourseDisplayStatus(ro, rc, ce, now);
      const enrollmentCount = countByCourse[c.id] ?? 0;
      const learningOpen = isCourseInLearningPeriod(cs, ce, now);
      const pendingDeletionRequestId = pendingByCourse[c.id] ?? null;

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        price_cents: c.price_cents,
        registration_open_at: ro,
        registration_close_at: rc,
        course_start_at: cs,
        course_end_at: ce,
        created_at: c.created_at,
        program: c.program,
        base_course: c.base_course,
        displayStatus,
        enrollmentCount,
        learningOpen,
        pendingDeletionRequestId,
        canRequestDeletion: enrollmentCount === 0 && !pendingDeletionRequestId,
      };
    })
    .filter((c) => {
      if (validFilter === "all") return true;
      if (validFilter === "registration") return c.displayStatus === "đang mở đăng ký";
      if (validFilter === "learning") return c.learningOpen;
      if (validFilter === "ended") return c.displayStatus === "đã kết thúc";
      return true;
    });

  const total = mapped.length;
  const totalPages = totalPagesFromCount(total, pageSize);
  const currentPage = clampPage(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const pagedCourses = mapped.slice(start, start + pageSize);

  return NextResponse.json({
    courses: pagedCourses,
    meta: {
      total,
      page: currentPage,
      pageSize,
      totalPages,
    },
  });
}
