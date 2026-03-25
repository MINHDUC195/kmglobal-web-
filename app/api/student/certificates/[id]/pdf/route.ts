import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../../lib/supabase-admin";
import {
  generateCertificatePdf,
  type CertificateTemplateConfig,
} from "../../../../../../lib/certificate-pdf";
import { requireCompleteStudentProfileForApi } from "../../../../../../lib/student-profile-api-guard";

export const maxDuration = 120;

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteProps) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Thiếu id chứng chỉ" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileBlock = await requireCompleteStudentProfileForApi(user.id);
    if (profileBlock) return profileBlock;

    const admin = getSupabaseAdminClient();

    const { data: cert, error: certErr } = await admin
      .from("certificates")
      .select("id, code, issued_at, base_course_id, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (certErr || !cert) {
      return NextResponse.json({ error: "Không tìm thấy chứng chỉ" }, { status: 404 });
    }

    const [{ data: baseCourse }, { data: profile }] = await Promise.all([
      admin
        .from("base_courses")
        .select("certificate_sample_url, certificate_template_config")
        .eq("id", cert.base_course_id)
        .single(),
      admin
        .from("profiles")
        .select("full_name, student_code, avatar_url")
        .eq("id", cert.user_id)
        .single(),
    ]);

    const sampleUrl = (baseCourse as { certificate_sample_url?: string | null } | null)
      ?.certificate_sample_url;
    if (!sampleUrl?.trim()) {
      return NextResponse.json(
        { error: "Khóa học chưa cấu hình mẫu chứng chỉ PDF/ảnh." },
        { status: 400 }
      );
    }

    const p = (profile as {
      full_name?: string | null;
      student_code?: string | null;
      avatar_url?: string | null;
    } | null) ?? { full_name: null, student_code: null, avatar_url: null };

    const pdfBytes = await generateCertificatePdf({
      certificateCode: cert.code,
      issueDate: cert.issued_at ? new Date(cert.issued_at) : new Date(),
      fullName: p.full_name?.trim() || "Học viên",
      studentCode: p.student_code?.trim() || "N/A",
      avatarUrl: p.avatar_url?.trim() || null,
      templateUrl: sampleUrl.trim(),
      templateConfig:
        ((baseCourse as { certificate_template_config?: CertificateTemplateConfig | null } | null)
          ?.certificate_template_config as CertificateTemplateConfig | null | undefined) ?? null,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="certificate-${cert.code}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("Generate certificate PDF error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống khi tạo PDF chứng chỉ" }, { status: 500 });
  }
}
