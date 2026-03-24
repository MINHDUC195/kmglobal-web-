import { describe, expect, it } from "vitest";
import { maskEmail } from "@/lib/privacy";

describe("maskEmail", () => {
  it("masks local part", () => {
    expect(maskEmail("hello@example.com")).toBe("he***@example.com");
  });

  it("handles short local part", () => {
    expect(maskEmail("a@b.com")).toBe("*@b.com");
  });
});
