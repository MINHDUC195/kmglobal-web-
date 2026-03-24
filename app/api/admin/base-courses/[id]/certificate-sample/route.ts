/**
 * POST /api/admin/base-courses/[id]/certificate-sample
 * Upload mẫu chứng chỉ (PDF hoặc ảnh) cho khóa cơ bản.
 * Body: FormData với file (key: file)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase-server";
import { getSupabaseAdminClient } from "../../../../../../lib/supabase-admin";

const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: baseCourseId } = await params;
    if (!baseCourseId) {
      return NextResponse.json({ error: "baseCourseId required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profile as { role?: string } | null)?.role;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File required (FormData key: file)" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File quá lớn (tối đa 5MB)" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Định dạng không hỗ trợ. Chỉ PDF, PNG, JPEG, WebP." },
        { status: 400 }
      );
    }

    const ext = file.type === "application/pdf" ? "pdf" : file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${baseCourseId}/sample.${ext}`;

    const admin = getSupabaseAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await admin.storage
      .from("certificate-samples")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error("Certificate sample upload error:", uploadErr);
      return NextResponse.json(
        { error: uploadErr.message || "Lỗi tải lên. Kiểm tra bucket certificate-samples đã tạo." },
        { status: 500 }
      );
    }

    const { data: urlData } = admin.storage.from("certificate-samples").getPublicUrl(path);
    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error("Certificate sample upload error:", err);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
