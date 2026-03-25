/**
 * Sau đăng ký OAuth từ /register (đã tick đồng ý), ghi nhận data_sharing_consent_at qua API.
 */
export async function applyPendingOAuthRegisterConsent(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem("oauth_register_consent_pending") !== "1") return;
    sessionStorage.removeItem("oauth_register_consent_pending");
    const res = await fetch("/api/auth/oauth-register-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) {
      console.warn("[oauth-register-consent]", res.status, await res.text());
    }
  } catch (e) {
    console.warn("[oauth-register-consent]", e);
  }
}
