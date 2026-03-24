/**
 * GET /api/student/enrollments
 * Danh sách khóa đã đăng ký của user hiện tại
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();
    const { data: enrollments, error } = await admin
      .from("enrollments")
      .select(
        `
        id,
        enrolled_at,
        regular_courses(id, name)
      `
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("enrolled_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (enrollments ?? []).map((e) => ({
      id: e.id,
      courseName: (e.regular_courses as { name?: string } | null)?.name ?? "Khóa học",
      enrolledAt: e.enrolled_at,
    }));

    return NextResponse.json({ enrollments: list });
  } catch (err) {
    console.error("Enrollments fetch error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
