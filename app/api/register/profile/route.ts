/**
 * POST /api/register/profile
 * Tạo/cập nhật profile sau khi đăng ký.
 * Dùng admin client để bypass RLS (tránh lỗi khi session chưa sẵn sàng hoặc RLS chặn insert).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { validateOrigin } from "../../../../lib/csrf";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../lib/rate-limit";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(
    rateLimitKeyFromRequest(request, "register-profile"),
    5,
    60_000
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429 }
    );
  }
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Chưa đăng nhập. Vui lòng đăng ký trước." }, { status: 401 });
    }

    const body = await request.json();
    const {
      fullName,
      email,
      address,
      company,
      phone,
      gender,
    } = body as {
      fullName?: string;
      email?: string;
      address?: string;
      company?: string;
      phone?: string;
      gender?: string;
    };

    const admin = getSupabaseAdminClient();
    const { error } = await admin.from("profiles").upsert(
      {
        id: user.id,
        full_name: fullName?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        role: "student",
        address: address?.trim() || null,
        company: company?.trim() || null,
        phone: phone?.trim() || null,
        gender: gender || null,
        security_signed: true,
        security_agreed_at: new Date().toISOString(),
        last_session_id: null,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Register profile error:", error);
      return NextResponse.json(
        { error: "Không thể lưu hồ sơ. Vui lòng thử lại hoặc liên hệ hỗ trợ." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Register profile error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
