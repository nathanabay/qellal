import { describe, it, expect } from "vitest";
import { prorate, paymentMatches } from "./billing-math";
import { isRenewalDue, nextDunningAction, type DunningSub } from "./dunning";
import { getPlan } from "./plans";

describe("prorate", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const end = new Date("2026-01-31T00:00:00Z"); // 30-day period

  it("credits the unused half of a period", () => {
    expect(prorate(299, new Date("2026-01-16T00:00:00Z"), start, end)).toBe(149.5);
  });
  it("is zero once the period has fully elapsed", () => {
    expect(prorate(299, new Date("2026-02-10T00:00:00Z"), start, end)).toBe(0);
  });
  it("is zero for a degenerate (non-positive) period", () => {
    expect(prorate(299, start, end, end)).toBe(0);
  });
});

describe("paymentMatches", () => {
  const expected = { amount: 299, currency: "ETB" };

  it("accepts the exact expected amount + currency", () => {
    expect(paymentMatches(expected, { amount: 299, currency: "ETB" })).toBe(true);
  });
  it("accepts a numeric string amount (Chapa may send a string)", () => {
    expect(paymentMatches(expected, { amount: "299" as unknown as number })).toBe(true);
  });
  it("defaults missing currency to ETB", () => {
    expect(paymentMatches(expected, { amount: 299 })).toBe(true);
  });
  it("rejects an underpaid amount", () => {
    expect(paymentMatches(expected, { amount: 1, currency: "ETB" })).toBe(false);
  });
  it("rejects a wrong currency", () => {
    expect(paymentMatches(expected, { amount: 299, currency: "USD" })).toBe(false);
  });
  it("rejects a missing amount", () => {
    expect(paymentMatches(expected, { currency: "ETB" })).toBe(false);
  });
});

describe("isRenewalDue", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  const base: DunningSub = {
    status: "active",
    current_period_end: null,
    past_due_since: null,
    dunning_attempt: 0,
  };

  it("is due when an active period has ended", () => {
    expect(isRenewalDue({ ...base, current_period_end: "2026-05-31T00:00:00Z" }, now)).toBe(true);
  });
  it("is not due when the period is still running", () => {
    expect(isRenewalDue({ ...base, current_period_end: "2026-06-30T00:00:00Z" }, now)).toBe(false);
  });
  it("is not due for a non-active sub", () => {
    expect(isRenewalDue({ ...base, status: "paused", current_period_end: "2026-05-31T00:00:00Z" }, now)).toBe(false);
  });
});

describe("nextDunningAction", () => {
  const now = new Date("2026-06-10T00:00:00Z");
  const base: DunningSub = {
    status: "past_due",
    current_period_end: null,
    past_due_since: null,
    dunning_attempt: 0,
  };
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

  it("returns none when not past_due", () => {
    expect(nextDunningAction({ ...base, status: "active" }, now)).toBe("none");
  });
  it("downgrades past the grace period", () => {
    expect(nextDunningAction({ ...base, past_due_since: daysAgo(8) }, now)).toBe("downgrade");
  });
  it("retries when a scheduled retry day is reached", () => {
    expect(nextDunningAction({ ...base, past_due_since: daysAgo(2), dunning_attempt: 0 }, now)).toBe("retry");
  });
  it("waits before the first retry day", () => {
    expect(nextDunningAction({ ...base, past_due_since: daysAgo(0.5), dunning_attempt: 0 }, now)).toBe("none");
  });
  it("waits when retries are exhausted but still within grace", () => {
    expect(nextDunningAction({ ...base, past_due_since: daysAgo(4), dunning_attempt: 3 }, now)).toBe("none");
  });
});

describe("getPlan", () => {
  it("resolves known plans", () => {
    expect(getPlan("pro").id).toBe("pro");
    expect(getPlan("free").id).toBe("free");
  });
  it("falls back to free for an unknown id", () => {
    expect(getPlan("enterprise").id).toBe("free");
  });
});
