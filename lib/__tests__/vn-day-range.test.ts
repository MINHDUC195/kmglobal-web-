import { describe, expect, it } from "vitest";
import { endOfVnDay, startOfVnDay } from "../vn-day-range";

describe("vn-day-range", () => {
  it("startOfVnDay sets 00:00 +07", () => {
    const d = startOfVnDay("2026-03-15T12:00:00Z");
    expect(d.toISOString()).toBe("2026-03-14T17:00:00.000Z");
  });

  it("endOfVnDay is last ms of VN calendar day", () => {
    const d = endOfVnDay("2026-03-15T12:00:00Z");
    expect(d.getTime() - startOfVnDay("2026-03-15T12:00:00Z").getTime()).toBe(24 * 60 * 60 * 1000 - 1);
  });
});
