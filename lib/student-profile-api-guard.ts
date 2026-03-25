import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "./supabase-admin";
import {
  studentProfileNeedsCompletion,
  type StudentProfileCompletionRow,
} from "./student-profile-completion";

const STUDENT_PROFILE_COMPLETION_SELECT_PRIMARY =
  "role,profile_completion_required,full_name,phone,security_signed,data_sharing_consent_at";
const STUDENT_PROFILE_COMPLETION_SELECT_FALLBACK = "role,full_name,phone,security_signed";

/** Dùng `any` để tránh TS "Type instantiation is excessively deep" với Supabase generics. */
export async function fetchStudentProfileCompletion(
  client: SupabaseClient<any>,
  userId: string
): Promise<{
  profile: StudentProfileCompletionRow;
  error: { message: string; code?: string } | null;
  degraded: boolean;
}> {
  const primary = await client
    .from("profiles")
    .select(STUDENT_PROFILE_COMPLETION_SELECT_PRIMARY)
    .eq("id", userId)
    .single();
  if (!primary.error) {
    return {
      profile: primary.data as StudentProfileCompletionRow,
      error: null,
      degraded: false,
    };
  }
  if (primary.error.code !== "42703") {
    return { profile: null, error: primary.error, degraded: false };
  }
  const fallback = await client
    .from("profiles")
    .select(STUDENT_PROFILE_COMPLETION_SELECT_FALLBACK)
    .eq("id", userId)
    .single();
  return {
    profile: fallback.data as StudentProfileCompletionRow,
    error: fallback.error,
    degraded: true,
  };
}

export function jsonStudentProfileIncomplete(): NextResponse {
  return NextResponse.json(
    {
      error:
        "Vui lòng hoàn tất hồ sơ (họ tên, SĐT, đồng ý chia sẻ dữ liệu) trước khi đăng ký, thanh toán hoặc học.",
      code: "STUDENT_PROFILE_INCOMPLETE",
    },
    { status: 403 }
  );
}

/**
 * Trả 403 nếu user là học viên và hồ sơ chưa đủ; null nếu được phép tiếp tục.
 */
export async function requireCompleteStudentProfileForApi(
  userId: string
): Promise<NextResponse | null> {
  const admin = getSupabaseAdminClient();
  const { profile, error } = await fetchStudentProfileCompletion(admin, userId);
  if (error) {
    console.error("student profile completion check:", error.message);
    return NextResponse.json({ error: "Không tải được hồ sơ" }, { status: 500 });
  }
  if (studentProfileNeedsCompletion(profile)) {
    return jsonStudentProfileIncomplete();
  }
  return null;
}

/** Trang: chặn học / đăng ký / checkout / dashboard học viên nếu hồ sơ thiếu. */
export function pageRequiresCompleteStudentProfile(pathname: string): boolean {
  if (pathname.startsWith("/student/profile")) return false;
  if (pathname.startsWith("/learn")) return true;
  if (pathname.startsWith("/checkout")) return true;
  if (pathname.startsWith("/courses")) return true;
  if (pathname.startsWith("/programs")) return true;
  if (pathname.startsWith("/student")) return true;
  return false;
}

/**
 * API nghiệp vụ: đăng ký khóa, thanh toán, học, tài liệu có watermark, chứng chỉ…
 * (Không gồm PATCH profile, agree-terms, v.v.)
 */
export function apiPathRequiresCompleteStudentProfile(pathname: string): boolean {
  if (/^\/api\/student\/enrollments\/[^/]+\/cancel$/.test(pathname)) return false;
  if (pathname === "/api/student/enroll") return true;
  if (pathname === "/api/checkout/init") return true;
  if (pathname.startsWith("/api/learn/progress")) return true;
  if (pathname.startsWith("/api/pdf/watermark")) return true;
  if (pathname === "/api/bunny/signed-url") return true;
  if (pathname.startsWith("/api/quiz/questions")) return true;
  if (pathname.startsWith("/api/quiz/submit")) return true;
  if (pathname.startsWith("/api/quiz/final-exam/submit")) return true;
  if (pathname.startsWith("/api/lesson-questions")) return true;
  if (pathname.startsWith("/api/student/enrollments")) return true;
  if (/^\/api\/courses\/[^/]+$/.test(pathname)) return true;
  if (/^\/api\/lessons\/[^/]+$/.test(pathname)) return true;
  if (/^\/api\/student\/certificates\/[^/]+\/pdf$/.test(pathname)) return true;
  return false;
}
