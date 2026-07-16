/**
 * PLAN GATING — free tier allowance, as pure arithmetic.
 *
 * Free accounts get a fixed number of worksheet generations per rolling window,
 * counted PER ACCOUNT (not per child): a family sharing one free account shares
 * one bucket. Every paid tier is unlimited. This module is pure — no DB, no
 * clock, `now` is an argument — so the rolling-window edges can be unit-tested
 * exhaustively. The server counts rows and calls `evaluateAllowance`; the gate
 * is enforced there, never in the client.
 */

export type PlanTier = "free" | "premium" | "family" | "school" | "therapist";

/** Worksheets a free account may generate per window. */
export const FREE_WEEKLY_LIMIT = 3;
/** Length of the rolling window, in days. */
export const WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

/** Every tier except free is unlimited. */
export function isUnlimited(tier: PlanTier): boolean {
  return tier !== "free";
}

export type Allowance = {
  tier: PlanTier;
  unlimited: boolean;
  /** Generations inside the current window. */
  used: number;
  /** The free-tier cap (shown as "used / limit"); informational when unlimited. */
  limit: number;
  /** Free generations left now. 0 when unlimited (read `unlimited` instead). */
  remaining: number;
  /** Whether a generation is permitted right now. */
  allowed: boolean;
  /**
   * When the next free slot opens — the moment the oldest in-window generation
   * exits it. null while `allowed` (nothing to wait for) and when unlimited.
   */
  unlockAt: Date | null;
};

/**
 * Decide whether an account may generate a worksheet now.
 *
 * `generatedAt` is the timestamps of the account's worksheet rows (any range —
 * we filter to the window here, so the caller can pass a cheap recent slice).
 */
export function evaluateAllowance(input: {
  tier: PlanTier;
  generatedAt: Date[];
  now: Date;
  limit?: number;
  windowDays?: number;
}): Allowance {
  const limit = input.limit ?? FREE_WEEKLY_LIMIT;
  const windowMs = (input.windowDays ?? WINDOW_DAYS) * DAY_MS;
  const windowStart = input.now.getTime() - windowMs;

  // Strictly inside the window: a generation exactly `windowDays` old has aged
  // out. Sorted oldest-first so index math below reads naturally.
  const inWindow = input.generatedAt
    .filter((d) => d.getTime() > windowStart)
    .sort((a, b) => a.getTime() - b.getTime());
  const used = inWindow.length;

  if (isUnlimited(input.tier)) {
    return { tier: input.tier, unlimited: true, used, limit, remaining: 0, allowed: true, unlockAt: null };
  }

  const allowed = used < limit;
  const remaining = Math.max(0, limit - used);

  // While over the cap, the next slot opens when enough of the oldest
  // generations age out to bring the count below the limit. The generation at
  // index (used - limit) is the one whose expiry does it.
  let unlockAt: Date | null = null;
  if (!allowed) {
    const freeing = inWindow[used - limit]!;
    unlockAt = new Date(freeing.getTime() + windowMs);
  }

  return { tier: input.tier, unlimited: false, used, limit, remaining, allowed, unlockAt };
}
