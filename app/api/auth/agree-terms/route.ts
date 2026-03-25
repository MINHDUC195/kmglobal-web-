import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { validateOrigin } from "../../../../lib/csrf";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../lib/rate-limit";
import { studentProfileNeedsCompletion } from "../../../../lib/student-profile-completion";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(
    rateLimitKeyFromRequest(request, "agree-terms"),
    10,
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

    const body = (await request.json().catch(() => ({}))) as {
      acceptedTerms?: boolean;
      acceptedPrivacy?: boolean;
    };
    if (!body.acceptedTerms || !body.acceptedPrivacy) {
      return NextResponse.json(
        { error: "Bạn cần xác nhận Điều khoản sử dụng và Chính sách bảo mật." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({
        security_signed: true,
        security_agreed_at: now,
      })
      .eq("id", user.id);

    if (error) {
      console.error("[agree-terms] profiles update failed:", error.message, error.code, error.details);
      const isDev = process.env.NODE_ENV === "development";
      return NextResponse.json(
        {
          error:
            /column .* does not exist|42703/i.test(error.message || "")
              ? "Cơ sở dữ liệu thiếu cột cần thiết. Quản trị viên cần kiểm tra migration bảng profiles (security_signed, security_agreed_at)."
              : "Không thể cập nhật. Vui lòng thử lại.",
          ...(isDev && { detail: error.message }),
        },
        { status: 500 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "role, full_name, address_street_number, address_street_name, address_ward, phone, data_sharing_consent_at"
      )
      .eq("id", user.id)
      .single();

    const incomplete = studentProfileNeedsCompletion(profile);

    return NextResponse.json({
      success: true,
      profileIncomplete: incomplete,
    });
  } catch {
    return NextResponse.json(
      { error: "Có lỗi hệ thống xảy ra." },
      { status: 500 }
    );
  }
}
