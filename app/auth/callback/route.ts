import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * PKCE `code` exchange on the server: verifier cookies arrive on the request;
 * the browser client alone can fail with pkce_code_verifier_not_found (cookie/storage timing).
 * Other flows (token_hash, hash fragment) are rewritten to /auth/callback/continue.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDesc = url.searchParams.get("error_description");

  if (oauthError) {
    const login = new URL("/login", request.url);
    login.searchParams.set("reason", "oauth");
    if (oauthErrorDesc) {
      login.searchParams.set("error_description", oauthErrorDesc);
    }
    return NextResponse.redirect(login);
  }

  if (code) {
    const completeUrl = new URL("/auth/callback/complete", request.url);
    const to = url.searchParams.get("to");
    if (to && to.startsWith("/") && !to.startsWith("//")) {
      completeUrl.searchParams.set("to", to);
    }

    const response = NextResponse.redirect(completeUrl);

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(new URL("/login?reason=oauth-exchange", request.url));
    }

    return response;
  }

  const rewriteUrl = url.clone();
  rewriteUrl.pathname = "/auth/callback/continue";
  return NextResponse.rewrite(rewriteUrl);
}
