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
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();

      if (cancelled) return;

      let next: DashboardHref = "/student";
      const role = profile?.role as string | undefined;
      if (role === "owner") next = "/owner";
      else if (role === "admin") next = "/admin";

      setHref(next);
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
