/**
 * POST /api/admin/base-courses/[id]/certificate-preview
 * Tạo PDF thử với dữ liệu giả — cùng engine generateCertificatePdf như chứng chỉ thật (hybrid preview).
 * Body (JSON, tùy chọn):
 * - certificate_template_config: object — nếu gửi, dùng cho preview (chưa cần Lưu).
 * - certificate_sample_url: string — nếu gửi, dùng làm mẫu (ví dụ sau khi upload, chưa reload DB).
 * - preview_avatar_url: string — HTTPS từ Supabase Storage / Bunny (giống quy tắc watermark PDF).
 *
 * Không dùng validateOrigin: route đã có auth admin + rate limit; tránh 403 khi dev (SITE_URL ≠ localhost).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../../lib/supabase-admin";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../../../lib/rate-limit";
import {
  generateCertificatePdf,
  type CertificateTemplateConfig,
} from "../../../../../../lib/certificate-pdf";

export const maxDuration = 120;

const ALLOWED_AVATAR_HOSTS = [
  /^[a-z0-9-]+\.supabase\.co$/i,
  /\.b-cdn\.net$/i,
  /\.bunnycdn\.com$/i,
];

function isPreviewAvatarUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_AVATAR_HOSTS.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, { params }: RouteProps) {
  const rl = await checkRateLimit(
    rateLimitKeyFromRequest(request, "admin-cert-preview"),
    30,
    60_000
  );
  if (!rl.ok) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu. Thử lại sau." }, { status: 429 });
  }

  try {
    const { id: baseCourseId } = await params;
    if (!baseCourseId) {
      return NextResponse.json({ error: "baseCourseId required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role?: string } | null)?.role;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: {
      certificate_template_config?: CertificateTemplateConfig | null;
      certificate_sample_url?: string | null;
      preview_avatar_url?: string | null;
    } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const admin = getSupabaseAdminClient();
    const { data: baseCourse, error: bcErr } = await admin
      .from("base_courses")
      .select("id, certificate_sample_url, certificate_template_config")
      .eq("id", baseCourseId)
      .single();

    if (bcErr || !baseCourse) {
      return NextResponse.json({ error: "Không tìm thấy khóa học cơ bản" }, { status: 404 });
    }

    const sampleFromBody =
      typeof body.certificate_sample_url === "string" ? body.certificate_sample_url.trim() : "";
    const sampleFromDb = (baseCourse as { certificate_sample_url?: string | null }).certificate_sample_url?.trim() ?? "";
    const templateUrl = sampleFromBody || sampleFromDb;

    if (!templateUrl) {
      return NextResponse.json(
        { error: "Chưa có mẫu chứng chỉ. Hãy tải lên PDF/ảnh trước." },
        { status: 400 }
      );
    }

    const templateConfig =
      body.certificate_template_config !== undefined
        ? (body.certificate_template_config as CertificateTemplateConfig | null)
        : ((baseCourse as { certificate_template_config?: CertificateTemplateConfig | null })
            .certificate_template_config as CertificateTemplateConfig | null | undefined) ?? null;

    let previewAvatar: string | null = null;
    const rawAvatar = typeof body.preview_avatar_url === "string" ? body.preview_avatar_url.trim() : "";
    if (rawAvatar) {
      if (!isPreviewAvatarUrlAllowed(rawAvatar)) {
        return NextResponse.json(
          { error: "URL ảnh xem trước không hợp lệ. Chỉ HTTPS từ Supabase Storage hoặc Bunny CDN." },
          { status: 400 }
        );
      }
      previewAvatar = rawAvatar;
    }

    const pdfBytes = await generateCertificatePdf({
      certificateCode: "KM-PREVIEW-LOCAL",
      issueDate: new Date(),
      fullName: "Nguyen Van A",
      studentCode: "440311-A000123",
      avatarUrl: previewAvatar,
      templateUrl,
      templateConfig,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="certificate-preview.pdf"',
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("Certificate preview error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi tạo PDF thử" }, { status: 500 });
  }
}
