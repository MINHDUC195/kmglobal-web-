import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { validateOrigin } from "@/lib/csrf";

function req(headers: Record<string, string>): NextRequest {
  return { headers: new Headers(headers) } as unknown as NextRequest;
}

describe("validateOrigin", () => {
  it("allows in development when site URL is missing", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(validateOrigin(req({}))).toBe(true);
  });

  it("blocks in production when site URL is missing", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(validateOrigin(req({ origin: "https://example.com" }))).toBe(false);
  });

  it("matches configured origin in production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SITE_URL = "https://kmglobal.vn";
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(validateOrigin(req({ origin: "https://kmglobal.vn" }))).toBe(true);
    expect(validateOrigin(req({ origin: "https://evil.example" }))).toBe(false);
  });
});
