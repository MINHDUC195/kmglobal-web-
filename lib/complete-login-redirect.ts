import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow } from "../types/database";
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

/**
 * Sau khi Supabase đã có session (mật khẩu, OTP, magic link…): thu hồi phiên cũ, cập nhật profile, redirect.
 */
export async function completeLoginRedirect(
  supabase: SupabaseClient,
  router: RouterLike,
  options?: { redirectTo?: string | null }
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) {
    router.push("/login?reason=not-authenticated");
    return;
  }

  const userId = session.user.id;
  const sessionId = getSessionIdFromToken(session.access_token);

  const { data: profileData } = await supabase
    .from("profiles")
    .select(
      "security_signed, role, full_name, address_street_number, address_street_name, address_ward, phone, phone_verified_at, data_sharing_consent_at"
    )
    .eq("id", userId)
    .single();

  const profile = profileData as
    | (Pick<ProfileRow, "security_signed" | "role"> & {
        full_name?: string | null;
        address_street_number?: string | null;
        address_street_name?: string | null;
        address_ward?: string | null;
        phone?: string | null;
        phone_verified_at?: string | null;
        data_sharing_consent_at?: string | null;
      })
    | null;

  const { error: revokeError } = await supabase.auth.signOut({ scope: "others" });
  if (revokeError) {
    console.warn("Không thể thu hồi toàn bộ phiên cũ:", revokeError.message);
  }

  await supabase.from("profiles").update({ last_session_id: sessionId || null }).eq("id", userId);

  let safeTo = "/";
  if (options?.redirectTo != null && options.redirectTo !== "") {
    const t = options.redirectTo;
    if (t.startsWith("/") && !t.startsWith("//")) safeTo = t;
  } else if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");
    if (to && to.startsWith("/") && !to.startsWith("//")) safeTo = to;
  }

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
