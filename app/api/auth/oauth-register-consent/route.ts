import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase-server";
import { validateOrigin } from "../../../../lib/csrf";
import { checkRateLimit, rateLimitKeyFromRequest } from "../../../../lib/rate-limit";

/**
 * POST /api/auth/oauth-register-consent
 * Ghi nhận đồng ý xử lý dữ liệu (kể cả từ OAuth) sau khi user đã tick trên trang đăng ký rồi hoàn tất OAuth.
 */
export async function POST(request: NextRequest) {
  const rl = await checkRateLimit(
    rateLimitKeyFromRequest(request, "oauth-register-consent"),
    10,
    60_000
  );
  if (!rl.ok) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu." }, { status: 429 });
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({ data_sharing_consent_at: now })
      .eq("id", user.id);

    if (error) {
      console.error("[oauth-register-consent]", error.message);
      return NextResponse.json({ error: "Không thể lưu đồng ý." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
