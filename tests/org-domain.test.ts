import { describe, expect, it } from "vitest";
import { normalizeOrgEmailDomain } from "@/lib/org-domain";
import { isOrgDomainSchemaMissingError } from "@/lib/org-domain-schema-error";

describe("isOrgDomainSchemaMissingError", () => {
  it("detects PostgREST schema cache message", () => {
    expect(
      isOrgDomainSchemaMissingError({
        message: "Could not find the table 'public.org_domain_policies' in the schema cache",
        code: "PGRST205",
      })
    ).toBe(true);
  });
  it("is false for unrelated errors", () => {
    expect(isOrgDomainSchemaMissingError({ message: "permission denied" })).toBe(false);
  });
});

describe("normalizeOrgEmailDomain", () => {
  it("extracts domain", () => {
    expect(normalizeOrgEmailDomain("User@Example.COM")).toBe("example.com");
    expect(normalizeOrgEmailDomain("a@sub.vn")).toBe("sub.vn");
  });
  it("returns null for invalid", () => {
    expect(normalizeOrgEmailDomain("")).toBeNull();
    expect(normalizeOrgEmailDomain("nope")).toBeNull();
  });
});
