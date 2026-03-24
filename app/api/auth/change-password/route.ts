/**
 * POST /api/auth/change-password
 * Đổi mật khẩu cho user đăng nhập và bỏ cờ must_change_password (lần đầu đăng nhập).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { validateOrigin } from "@/lib/csrf";
import { checkRateLimit } from "@/lib/rate-limit";
import { validatePasswordStrength } from "@/lib/password-policy";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Bạn cần đăng nhập để thực hiện thao tác này." },
        { status: 401 }
      );
    }

    const rl = await checkRateLimit(`change-password:${user.id}`, 5, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Quá nhiều lần thử. Thử lại sau." },
        { status: 429 }
      );
    }

    let body: { newPassword?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    const newPassword = body.newPassword?.trim() ?? "";
    const strength = validatePasswordStrength(newPassword);
    if (!strength.ok) {
      return NextResponse.json({ error: strength.message ?? "Mật khẩu không đủ mạnh." }, { status: 400 });
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      console.error("change-password updateError:", updateError);
      return NextResponse.json(
        { error: "Không thể đổi mật khẩu. Kiểm tra yêu cầu độ mạnh và thử lại." },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdminClient();
    const { error: profileError } = await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);

    if (profileError) {
      return NextResponse.json(
        { error: "Đổi mật khẩu thành công nhưng cập nhật trạng thái thất bại." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Có lỗi hệ thống xảy ra." },
      { status: 500 }
    );
  }
}
