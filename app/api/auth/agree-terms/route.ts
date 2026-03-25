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
      acceptedThirdPartyData?: boolean;
    };
    if (!body.acceptedTerms || !body.acceptedPrivacy || !body.acceptedThirdPartyData) {
      return NextResponse.json(
        { error: "Bạn cần xác nhận đầy đủ Điều khoản, Chính sách bảo mật và chia sẻ dữ liệu bên thứ ba." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({
        security_signed: true,
        security_agreed_at: now,
        data_sharing_consent_at: now,
      })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json(
        { error: "Không thể cập nhật. Vui lòng thử lại." },
        { status: 500 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "role, full_name, address_street_number, address_street_name, address_ward, phone, phone_verified_at, data_sharing_consent_at"
      )
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      success: true,
      profileIncomplete: studentProfileNeedsCompletion(profile),
    });
  } catch {
    return NextResponse.json(
      { error: "Có lỗi hệ thống xảy ra." },
      { status: 500 }
    );
  }
}
