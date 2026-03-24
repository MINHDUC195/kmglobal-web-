import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { addWatermarkToPdf } from "@/lib/pdf-watermark";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getLessonWithAccess } from "@/lib/lesson-access";
import { checkRateLimit, rateLimitKeyFromRequest } from "@/lib/rate-limit";

export const maxDuration = 30;

const ALLOWED_HOSTS = [
  /^[a-z0-9-]+\.supabase\.co$/i,
  /\.b-cdn\.net$/i,
  /\.bunnycdn\.com$/i,
];

const BLOCKED_IPS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
  /^localhost$/i,
  /^::1$/,
];

function isUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_IPS.some((re) => re.test(hostname))) return false;
    return ALLOWED_HOSTS.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

/**
 * POST /api/pdf/watermark
 * Body: { lessonId: string, enrollmentId?: string | null }
 * Hoặc (chỉ owner/admin): { previewDocumentUrl: string } — xem trước PDF trong form.
 */
export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(rateLimitKeyFromRequest(request, "pdf-watermark"), 60, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu. Thử lại sau." }, { status: 429 });
  }

  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const previewDocumentUrl =
      typeof body?.previewDocumentUrl === "string" ? body.previewDocumentUrl.trim() : "";

    if (previewDocumentUrl) {
      const admin = getSupabaseAdminClient();
      const { data: roleRow } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const role = (roleRow as { role?: string } | null)?.role;
      if (role !== "owner" && role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (!isUrlAllowed(previewDocumentUrl)) {
        return NextResponse.json(
          { error: "pdfUrl not allowed. Only HTTPS from Supabase Storage or Bunny CDN." },
          { status: 400 }
        );
      }
      const { data: wmProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      const userName = (wmProfile as { full_name?: string } | null)?.full_name?.trim() || "Học viên";
      const userEmail =
        (wmProfile as { email?: string } | null)?.email?.trim() || authUser?.email || "";
      return await fetchAndWatermarkResponse(previewDocumentUrl, userName, userEmail);
    }

    const lessonId = typeof body?.lessonId === "string" ? body.lessonId.trim() : "";
    if (!lessonId) {
      return NextResponse.json({ error: "lessonId or previewDocumentUrl required" }, { status: 400 });
    }

    const enrollmentId =
      typeof body?.enrollmentId === "string" && body.enrollmentId.trim()
        ? body.enrollmentId.trim()
        : null;

    const admin = getSupabaseAdminClient();
    const access = await getLessonWithAccess(admin, user.id, lessonId, enrollmentId);

    if (!access.ok) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }

    const pdfUrl = access.lesson.document_url;
    if (!pdfUrl?.trim()) {
      return NextResponse.json({ error: "Bài học không có tài liệu PDF" }, { status: 404 });
    }

    if (!isUrlAllowed(pdfUrl.trim())) {
      return NextResponse.json(
        { error: "Document URL not allowed for watermark." },
        { status: 400 }
      );
    }

    const { data: wmProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const userName = (wmProfile as { full_name?: string } | null)?.full_name?.trim() || "Học viên";
    const userEmail =
      (wmProfile as { email?: string } | null)?.email?.trim() || authUser?.email || "";

    return await fetchAndWatermarkResponse(pdfUrl.trim(), userName, userEmail);
  } catch (err) {
    console.error("PDF watermark error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function fetchAndWatermarkResponse(pdfUrl: string, userName: string, userEmail: string) {
  const res = await fetch(pdfUrl, {
    headers: { "User-Agent": "KMGlobal-Academy/1.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Cannot fetch PDF" }, { status: 400 });
  }

  const contentLength = res.headers.get("content-length");
  const maxSize = 10 * 1024 * 1024;
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    return NextResponse.json({ error: "PDF too large" }, { status: 400 });
  }

  const pdfBuffer = await res.arrayBuffer();
  if (pdfBuffer.byteLength > maxSize) {
    return NextResponse.json({ error: "PDF too large" }, { status: 400 });
  }

  const watermarkedPdf = await addWatermarkToPdf(pdfBuffer, {
    userName,
    userEmail,
  });

  return new NextResponse(Buffer.from(watermarkedPdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=document.pdf",
    },
  });
}
