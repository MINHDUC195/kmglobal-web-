import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to limit", async () => {
    const key = `t-${Math.random()}`;
    expect((await checkRateLimit(key, 3, 60_000)).ok).toBe(true);
    expect((await checkRateLimit(key, 3, 60_000)).ok).toBe(true);
    expect((await checkRateLimit(key, 3, 60_000)).ok).toBe(true);
  });

  it("rejects after limit exceeded", async () => {
    const key = `t-block-${Math.random()}`;
    expect((await checkRateLimit(key, 2, 60_000)).ok).toBe(true);
    expect((await checkRateLimit(key, 2, 60_000)).ok).toBe(true);
    expect((await checkRateLimit(key, 2, 60_000)).ok).toBe(false);
  });
});
