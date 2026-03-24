import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Next.js 16+: `proxy` replaces deprecated `middleware` file convention.
 * Bảo vệ /owner (chỉ owner), /admin (owner | admin), /student, /learn, /checkout — sai role → /student.
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  function redirectToLogin() {
    const to = pathname + request.nextUrl.search;
    const params = new URLSearchParams({ reason: "not-authenticated" });
    if (to && to !== "/" && to.startsWith("/")) params.set("to", to);
    return NextResponse.redirect(new URL(`/login?${params.toString()}`, request.url));
  }

  // Bảo vệ route /owner - chỉ owner
  if (pathname.startsWith("/owner")) {
    if (!user) {
      return redirectToLogin();
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "owner") {
      return NextResponse.redirect(new URL("/student", request.url));
    }
    if ((profile as { must_change_password?: boolean } | null)?.must_change_password) {
      const to = pathname + request.nextUrl.search;
      return NextResponse.redirect(
        new URL(`/auth/change-password?required=1&to=${encodeURIComponent(to || "/owner")}`, request.url)
      );
    }
  }

  // Bảo vệ route /admin - owner hoặc admin
  if (pathname.startsWith("/admin")) {
    if (!user) {
      return redirectToLogin();
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "owner" && profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/student", request.url));
    }
    if ((profile as { must_change_password?: boolean } | null)?.must_change_password) {
      const to = pathname + request.nextUrl.search;
      return NextResponse.redirect(
        new URL(`/auth/change-password?required=1&to=${encodeURIComponent(to || "/admin")}`, request.url)
      );
    }
  }

  // Bảo vệ route /student - chỉ student (hoặc admin/owner xem thay)
  if (pathname.startsWith("/student")) {
    if (!user) return redirectToLogin();
  }

  // Bảo vệ route /learn
  if (pathname.startsWith("/learn")) {
    if (!user) return redirectToLogin();
  }

  // Bảo vệ route /checkout
  if (pathname.startsWith("/checkout")) {
    if (!user) return redirectToLogin();
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo|public|api|verify|terms-of-service|privacy-policy|auth).*)",
  ],
};
