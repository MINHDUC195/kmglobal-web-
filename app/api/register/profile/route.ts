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
import {
  isPhoneUniqueViolation,
  normalizePhoneToE164,
  PHONE_IN_USE_MESSAGE,
} from "../../../../lib/phone-normalize";

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

    const phoneTrim = phone?.trim() || "";
    let phoneE164: string | null = null;
    if (phoneTrim) {
      phoneE164 = normalizePhoneToE164(phoneTrim);
      if (!phoneE164) {
        return NextResponse.json(
          { error: "Số điện thoại không hợp lệ. Dùng dạng trong nước (vd. 09…) hoặc quốc tế (+84…)." },
          { status: 400 }
        );
      }
    }

    const admin = getSupabaseAdminClient();
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const existingRole = (existingProfile as { role?: string | null } | null)?.role ?? null;
    const roleToPersist =
      existingRole === "owner" || existingRole === "admin" ? existingRole : "student";

    const { error } = await admin.from("profiles").upsert(
      {
        id: user.id,
        full_name: fullName?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        role: roleToPersist,
        address: address?.trim() || null,
        company: company?.trim() || null,
        phone: phoneTrim || null,
        phone_e164: phoneE164,
        gender: gender || null,
        security_signed: true,
        security_agreed_at: new Date().toISOString(),
        last_session_id: null,
      },
      { onConflict: "id" }
    );

    if (error) {
      console.error("Register profile error:", error);
      if (isPhoneUniqueViolation(error)) {
        return NextResponse.json({ error: PHONE_IN_USE_MESSAGE }, { status: 409 });
      }
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
