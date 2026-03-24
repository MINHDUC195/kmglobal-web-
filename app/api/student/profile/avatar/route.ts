/**
 * POST /api/student/profile/avatar
 * multipart/form-data: field "file" — ảnh đại diện (jpeg/png/webp, tối đa 2MB)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const rl = await checkRateLimit(`avatar-upload:${user.id}`, 15, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Quá nhiều lần tải ảnh. Thử lại sau." },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file ảnh" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Ảnh tối đa 2MB" }, { status: 400 });
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.has(mime)) {
    return NextResponse.json(
      { error: "Chỉ chấp nhận JPEG, PNG hoặc WebP" },
      { status: 400 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extFromMime(mime);
  const path = `${user.id}/avatar.${ext}`;

  const admin = getSupabaseAdminClient();
  const { error: upErr } = await admin.storage.from("avatars").upload(path, buf, {
    upsert: true,
    contentType: mime,
    cacheControl: "3600",
  });

  if (upErr) {
    console.error("Avatar upload error:", upErr);
    return NextResponse.json(
      { error: upErr.message || "Không thể tải ảnh lên" },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(path);

  const { error: dbErr } = await admin
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (dbErr) {
    console.error("Avatar URL save error:", dbErr);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, avatarUrl: publicUrl });
}
