import { NextResponse } from "next/server";

/** Thông báo cho Owner khi bảng org_domain chưa có trên Supabase (migration chưa chạy hoặc schema cache). */
export const ORG_DOMAIN_SCHEMA_MISSING_VI =
  "Cơ sở dữ liệu chưa có bảng miễn phí theo domain (migration chưa chạy trên project Supabase này). " +
  "Vào Supabase Dashboard → SQL Editor, chạy toàn bộ file supabase/migrations/20260328120000_org_domain_entitlements.sql. " +
  "Nếu vẫn báo lỗi schema cache, trong SQL Editor chạy thêm: NOTIFY pgrst, 'reload schema';";

export const ORG_DOMAIN_SCHEMA_MISSING_CODE = "ORG_DOMAIN_SCHEMA_MISSING" as const;

export function collectSupabaseErrorText(err: unknown): string {
  if (err == null) return "";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);
  const o = err as Record<string, unknown>;
  return [o.message, o.details, o.hint, o.code]
    .filter((x) => x != null && x !== "")
    .map(String)
    .join(" ");
}

/** Lỗi PostgREST/Postgres khi bảng org_domain_* chưa tồn tại hoặc chưa vào schema cache. */
export function isOrgDomainSchemaMissingError(err: unknown): boolean {
  const s = collectSupabaseErrorText(err).toLowerCase();
  if (!s) return false;
  if (s.includes("schema cache")) return true;
  if (s.includes("could not find the table")) return true;
  if (s.includes("pgrst205")) return true;
  if (s.includes("42p01")) return true;
  if (s.includes("org_domain") && (s.includes("does not exist") || s.includes("could not find"))) return true;
  return false;
}

export function orgDomainSchemaMissingJsonResponse() {
  return NextResponse.json(
    { error: ORG_DOMAIN_SCHEMA_MISSING_VI, code: ORG_DOMAIN_SCHEMA_MISSING_CODE },
    { status: 503 }
  );
}
