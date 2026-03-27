import { describe, expect, it } from "vitest";
import {
  momoIpnAmountMatchesDb,
  stripeSessionAmountMatchesDb,
  vnpayAmountMatchesDb,
  vnpayQueryAmountToVnd,
} from "../lib/payment-gateway-verify";

describe("payment-gateway-verify", () => {
  it("momo: matches integer VND", () => {
    expect(momoIpnAmountMatchesDb(500000, 500000)).toBe(true);
    expect(momoIpnAmountMatchesDb("500000", 500000)).toBe(true);
    expect(momoIpnAmountMatchesDb(500001, 500000)).toBe(false);
  });

  it("vnpay: vnp_Amount is VND * 100", () => {
    expect(vnpayQueryAmountToVnd("50000000")).toBe(500000);
    expect(vnpayAmountMatchesDb("50000000", 500000)).toBe(true);
    expect(vnpayAmountMatchesDb("50000100", 500000)).toBe(false);
  });

  it("stripe: amount_total vs DB", () => {
    expect(stripeSessionAmountMatchesDb(990000, 990000)).toBe(true);
    expect(stripeSessionAmountMatchesDb(null, 1)).toBe(false);
    expect(stripeSessionAmountMatchesDb(100, 101)).toBe(false);
  });
});
