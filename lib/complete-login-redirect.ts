import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRowForLoginRedirect } from "../types/database";
import type { TypedSupabaseClient } from "./supabase-database";
import { studentProfileNeedsCompletion } from "./student-profile-completion";

export function getSessionIdFromToken(token?: string | null): string | null {
  if (!token) return null;
  const segments = token.split(".");
  if (segments.length < 2) return null;
  try {
    const base64 = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const payload = JSON.parse(json) as { session_id?: string };
    return payload.session_id || null;
  } catch {
    return null;
  }
}

type RouterLike = { push: (href: string) => void };

/** Đích mặc định sau đăng nhập khi không có deep link (`?to=` trống hoặc `/`). */
export function defaultPostLoginPathForRole(role: string | undefined | null): "/owner" | "/admin" | "/student" {
  if (role === "owner") return "/owner";
  if (role === "admin") return "/admin";
  return "/student";
}

/**
 * Sau khi Supabase đã có session (mật khẩu, OTP, magic link…): thu hồi phiên cũ, cập nhật profile, redirect.
 *
 * **Ưu tiên `?to=` / `redirectTo`:** Nếu có đường dẫn nội bộ hợp lệ và khác `/` → dùng làm đích (sau agree-terms / hoàn hồ sơ nếu cần).
 * Ngược lại → dashboard theo `role` (`/owner`, `/admin`, `/student`).
 */
export async function completeLoginRedirect(
  supabase: SupabaseClient,
  router: RouterLike,
  options?: { redirectTo?: string | null }
): Promise<void> {
  const typedSupabase = supabase as TypedSupabaseClient;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    router.push("/login?reason=not-authenticated");
    return;
  }

  const userId = session.user.id;
  const sessionId = getSessionIdFromToken(session.access_token);

  const { data: profileData } = await typedSupabase
    .from("profiles")
    .select(
      "security_signed, role, full_name, address_street_number, address_street_name, address_ward, phone, data_sharing_consent_at"
    )
    .eq("id", userId)
    .single();

  const profile = profileData as ProfileRowForLoginRedirect | null;

  const { error: revokeError } = await supabase.auth.signOut({ scope: "others" });
  if (revokeError) {
    console.warn("Không thể thu hồi toàn bộ phiên cũ:", revokeError.message);
  }

  await typedSupabase.from("profiles").update({ last_session_id: sessionId || null }).eq("id", userId);

  let candidate: string | null = null;
  if (options?.redirectTo != null && options.redirectTo !== "") {
    const t = options.redirectTo;
    if (t.startsWith("/") && !t.startsWith("//")) candidate = t;
  } else if (typeof window !== "undefined") {
    const to = new URLSearchParams(window.location.search).get("to");
    if (to && to.startsWith("/") && !to.startsWith("//")) candidate = to;
  }

  const dashboard = defaultPostLoginPathForRole(profile?.role);
  const safeTo = candidate && candidate !== "/" ? candidate : dashboard;

  if (!profile?.security_signed) {
    router.push(`/auth/agree-terms?to=${encodeURIComponent(safeTo)}`);
    return;
  }

  if (studentProfileNeedsCompletion(profile)) {
    router.push(`/student/profile?required=1&to=${encodeURIComponent(safeTo)}`);
    return;
  }

  router.push(safeTo);
}
