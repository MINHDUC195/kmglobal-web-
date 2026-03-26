import { describe, expect, it } from "vitest";
import { normalizeOrgEmailDomain } from "@/lib/org-domain";

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
