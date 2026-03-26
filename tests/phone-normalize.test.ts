import { describe, expect, it } from "vitest";
import { normalizePhoneToE164 } from "@/lib/phone-normalize";

describe("normalizePhoneToE164", () => {
  it("maps VN domestic and international forms to one E.164", () => {
    const expected = "+84901234567";
    expect(normalizePhoneToE164("0901234567")).toBe(expected);
    expect(normalizePhoneToE164("84901234567")).toBe(expected);
    expect(normalizePhoneToE164("+84 90 123 4567")).toBe(expected);
    expect(normalizePhoneToE164("+84901234567")).toBe(expected);
  });

  it("accepts other E.164 countries", () => {
    expect(normalizePhoneToE164("+1 415 555 0100")).toBe("+14155550100");
  });

  it("returns null for empty or invalid", () => {
    expect(normalizePhoneToE164("")).toBeNull();
    expect(normalizePhoneToE164("   ")).toBeNull();
    expect(normalizePhoneToE164("abc")).toBeNull();
  });
});
