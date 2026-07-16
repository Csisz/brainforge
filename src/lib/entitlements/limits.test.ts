import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { evaluateAllowance, FREE_WEEKLY_LIMIT, WINDOW_DAYS, isUnlimited, type PlanTier } from "./limits";

const NOW = new Date("2026-07-16T12:00:00Z");
const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(NOW.getTime() - d * DAY);
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);

const free = (generatedAt: Date[]) => evaluateAllowance({ tier: "free", generatedAt, now: NOW });

describe("tiers", () => {
  test("only free is limited", () => {
    assert.equal(isUnlimited("free"), false);
    for (const t of ["premium", "family", "school", "therapist"] as PlanTier[]) {
      assert.equal(isUnlimited(t), true);
    }
  });

  test("a paid tier is allowed no matter how many it has generated", () => {
    const a = evaluateAllowance({ tier: "premium", generatedAt: [hoursAgo(1), hoursAgo(2), hoursAgo(3), hoursAgo(4)], now: NOW });
    assert.equal(a.allowed, true);
    assert.equal(a.unlimited, true);
    assert.equal(a.unlockAt, null);
    assert.equal(a.used, 4, "used is still reported, for display");
  });
});

describe("free tier — counting inside the window", () => {
  test("nothing generated yet: full allowance", () => {
    const a = free([]);
    assert.equal(a.allowed, true);
    assert.equal(a.used, 0);
    assert.equal(a.remaining, FREE_WEEKLY_LIMIT);
    assert.equal(a.unlockAt, null);
  });

  test("under the cap: allowed with the right remainder", () => {
    const a = free([hoursAgo(1), hoursAgo(2)]);
    assert.equal(a.allowed, true);
    assert.equal(a.used, 2);
    assert.equal(a.remaining, 1);
    assert.equal(a.unlockAt, null);
  });

  test("exactly at the cap: blocked", () => {
    const a = free([hoursAgo(1), hoursAgo(2), hoursAgo(3)]);
    assert.equal(a.allowed, false);
    assert.equal(a.used, 3);
    assert.equal(a.remaining, 0);
  });

  test("generations older than the window do not count", () => {
    const a = free([daysAgo(8), daysAgo(9), daysAgo(10)]);
    assert.equal(a.used, 0);
    assert.equal(a.allowed, true);
    assert.equal(a.remaining, 3);
  });

  test("a mix: only in-window generations count", () => {
    const a = free([hoursAgo(2), daysAgo(8), daysAgo(3), daysAgo(30)]);
    assert.equal(a.used, 2, "hoursAgo(2) and daysAgo(3) are in window; the two >7d are not");
    assert.equal(a.remaining, 1);
  });
});

describe("the window boundary is exclusive", () => {
  test("exactly 7 days old has aged out", () => {
    const a = free([daysAgo(WINDOW_DAYS), hoursAgo(1), hoursAgo(2)]);
    assert.equal(a.used, 2, "the 7-day-old one is out");
    assert.equal(a.allowed, true);
  });

  test("a hair under 7 days is still in", () => {
    const a = free([new Date(NOW.getTime() - (WINDOW_DAYS * DAY - 60_000)), hoursAgo(1), hoursAgo(2)]);
    assert.equal(a.used, 3);
    assert.equal(a.allowed, false);
  });
});

describe("unlock time", () => {
  test("opens exactly one window after the oldest in-window generation", () => {
    const oldest = daysAgo(5);
    const a = free([oldest, daysAgo(2), hoursAgo(1)]);
    assert.equal(a.allowed, false);
    assert.equal(a.unlockAt?.getTime(), oldest.getTime() + WINDOW_DAYS * DAY);
  });

  test("with more than the cap in window (defensive), it is the right one that frees a slot", () => {
    // 4 in window, limit 3: the 2nd-oldest exiting brings count to 2 < 3.
    const ts = [daysAgo(6), daysAgo(5), daysAgo(2), hoursAgo(1)];
    const a = evaluateAllowance({ tier: "free", generatedAt: ts, now: NOW });
    assert.equal(a.allowed, false);
    // used - limit = 4 - 3 = 1 → second oldest (daysAgo(5)).
    assert.equal(a.unlockAt?.getTime(), daysAgo(5).getTime() + WINDOW_DAYS * DAY);
  });

  test("the unlock moment is in the future while blocked", () => {
    const a = free([daysAgo(6), daysAgo(4), daysAgo(1)]);
    assert.ok(a.unlockAt!.getTime() > NOW.getTime(), "oldest is 6d old, so unlock is ~1 day out");
  });
});

describe("custom limits (used by tests and any future tier tuning)", () => {
  test("respects an overridden limit and window", () => {
    const a = evaluateAllowance({ tier: "free", generatedAt: [hoursAgo(1)], now: NOW, limit: 1, windowDays: 1 });
    assert.equal(a.allowed, false);
    assert.equal(a.limit, 1);
  });
});
