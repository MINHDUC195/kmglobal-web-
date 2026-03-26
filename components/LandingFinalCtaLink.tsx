"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type DashboardHref = "/login" | "/student" | "/admin" | "/owner";

type LandingFinalCtaLinkProps = {
  serverHref: DashboardHref;
  className: string;
  children: ReactNode;
};

const supabase = getSupabaseBrowserClient();

export default function LandingFinalCtaLink({ serverHref, className, children }: LandingFinalCtaLinkProps) {
  const [href, setHref] = useState<DashboardHref>(serverHref);

  useEffect(() => {
    let cancelled = false;

    async function resolveClientHref() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!session?.user) {
        setHref("/login");
        // #region agent log
        fetch("http://127.0.0.1:7813/ingest/2622e3a9-df77-46ca-ab07-dad3169e247f", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "56767c" },
          body: JSON.stringify({
            sessionId: "56767c",
            location: "LandingFinalCtaLink.tsx:resolveClientHref",
            message: "final CTA href resolved (client)",
            data: {
              hypothesisId: "H1",
              hasClientSession: false,
              serverHref,
              resolvedHref: "/login",
            },
            timestamp: Date.now(),
            runId: "post-fix-verify",
          }),
        }).catch(() => {});
        // #endregion
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();

      if (cancelled) return;

      let next: DashboardHref = "/student";
      const role = profile?.role as string | undefined;
      if (role === "owner") next = "/owner";
      else if (role === "admin") next = "/admin";

      setHref(next);

      // #region agent log
      fetch("http://127.0.0.1:7813/ingest/2622e3a9-df77-46ca-ab07-dad3169e247f", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "56767c" },
        body: JSON.stringify({
          sessionId: "56767c",
          location: "LandingFinalCtaLink.tsx:resolveClientHref",
          message: "final CTA href resolved (client)",
          data: {
            hypothesisId: "H1",
            hasClientSession: true,
            serverHref,
            resolvedHref: next,
            serverMismatch: serverHref !== next,
          },
          timestamp: Date.now(),
          runId: "post-fix-verify",
        }),
      }).catch(() => {});
      // #endregion
    }

    void resolveClientHref();

    return () => {
      cancelled = true;
    };
  }, [serverHref]);

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
