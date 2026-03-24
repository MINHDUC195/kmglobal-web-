import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSignedEmbedUrl } from "@/lib/bunny";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getLessonWithAccess } from "@/lib/lesson-access";
import { checkRateLimit, rateLimitKeyFromRequest } from "@/lib/rate-limit";

/**
 * GET /api/bunny/signed-url?lessonId=...&enrollmentId=...
 * Ký URL Bunny từ video_url trong DB sau khi xác minh quyền học (hoặc staff).
 *
 * GET ?previewVideoUrl=... — chỉ owner/admin: xem trước URL trong form (chưa lưu DB).
 */
export async function GET(request: NextRequest) {
  const rl = await checkRateLimit(rateLimitKeyFromRequest(request, "bunny-signed"), 120, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu. Thử lại sau." }, { status: 429 });
  }

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

  const previewVideoUrl = request.nextUrl.searchParams.get("previewVideoUrl");
  if (previewVideoUrl?.trim()) {
    const admin = getSupabaseAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role?: string } | null)?.role;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const signedUrl = getSignedEmbedUrl(previewVideoUrl.trim(), 3600);
    if (!signedUrl) {
      return NextResponse.json({ error: "Invalid Bunny video URL" }, { status: 400 });
    }
    return NextResponse.json({ url: signedUrl });
  }

  const lessonId = request.nextUrl.searchParams.get("lessonId");
  if (!lessonId?.trim()) {
    return NextResponse.json({ error: "lessonId or previewVideoUrl required" }, { status: 400 });
  }

  const enrollmentId = request.nextUrl.searchParams.get("enrollmentId");
  const admin = getSupabaseAdminClient();
  const access = await getLessonWithAccess(admin, user.id, lessonId.trim(), enrollmentId);

  if (!access.ok) {
    return NextResponse.json({ error: access.message }, { status: access.status });
  }

  const videoUrl = access.lesson.video_url;
  if (!videoUrl?.trim()) {
    return NextResponse.json({ error: "Bài học không có video" }, { status: 404 });
  }

  const signedUrl = getSignedEmbedUrl(videoUrl.trim(), 3600);
  if (!signedUrl) {
    return NextResponse.json({ error: "Invalid Bunny video URL" }, { status: 400 });
  }

  return NextResponse.json({ url: signedUrl });
}
