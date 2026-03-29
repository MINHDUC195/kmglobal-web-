/**
 * Cache catalog queries (programs + regular_courses) to reduce DB load on public pages.
 * Invalidate with revalidateTag("catalog") after admin updates (optional API).
 */

import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "./supabase-admin";

const REVALIDATE_SEC = 120;

type CatalogProgramsRow = {
  id: string;
  name: string;
  code: string | null;
  note: string | null;
  base_courses: { id: string; name: string }[] | null;
};

type CatalogRegularCourseRow = {
  id: string;
  name: string;
  price_cents: number | null;
  discount_percent?: number | null;
  promotion_tiers?: unknown;
  active_enrollment_count?: number;
  approval_status?: string | null;
  registration_open_at: string | null;
  registration_close_at: string | null;
  course_start_at: string | null;
  course_end_at: string | null;
  program_id: string | null;
  base_course: {
    id: string;
    name: string;
    code: string | null;
    summary: string | null;
  } | null;
  program: { id: string; name: string; code: string | null } | null;
};

async function fetchApprovedPrograms(): Promise<CatalogProgramsRow[]> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("programs")
    .select(
      `
      id,
      name,
      code,
      note,
      base_courses(id, name)
    `
    )
    .eq("approval_status", "approved")
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as CatalogProgramsRow[];
}

async function fetchRegularCoursesCatalog(): Promise<CatalogRegularCourseRow[]> {
  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("regular_courses")
    .select(
      `
      id,
      name,
      price_cents,
      discount_percent,
      promotion_tiers,
      active_enrollment_count,
      approval_status,
      registration_open_at,
      registration_close_at,
      course_start_at,
      course_end_at,
      program_id,
      base_course:base_courses(id, name, code, summary),
      program:programs(id, name, code)
    `
    )
    .eq("approval_status", "approved")
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as CatalogRegularCourseRow[];
}

/** Approved programs (landing program section). */
export const getCachedApprovedPrograms = unstable_cache(
  fetchApprovedPrograms,
  ["catalog-programs-approved-v1"],
  { revalidate: REVALIDATE_SEC, tags: ["catalog"] }
);

/** All regular courses with program/base joins (landing, /courses, program courses). */
export const getCachedRegularCoursesCatalog = unstable_cache(
  fetchRegularCoursesCatalog,
  ["catalog-regular-courses-v3"],
  { revalidate: REVALIDATE_SEC, tags: ["catalog"] }
);
