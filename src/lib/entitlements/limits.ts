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

/**
 * THE ONE PLACE plan limits live. Every gate — child creation, worksheet
 * generation, usage display — reads from here, so a pricing experiment is a
 * one-line change and there are no scattered literals to miss.
 *
 * `weeklyWorksheets: null` means unlimited. `children` is the hard cap enforced
 * at child creation.
 */
export const PLAN_LIMITS: Record<PlanTier, { children: number; weeklyWorksheets: number | null }> = {
  free: { children: 1, weeklyWorksheets: 3 },
  premium: { children: 1, weeklyWorksheets: null },
  family: { children: 4, weeklyWorksheets: null },
  school: { children: 50, weeklyWorksheets: null },
  therapist: { children: 50, weeklyWorksheets: null },
};

/** Worksheets a free account may generate per window. */
export const FREE_WEEKLY_LIMIT = PLAN_LIMITS.free.weeklyWorksheets!;
/** Length of the rolling window, in days. */
export const WINDOW_DAYS = 7;
const DAY_MS = 86_400_000;

/** Whether a tier's worksheet generation is unlimited. */
export function isUnlimited(tier: PlanTier): boolean {
  return PLAN_LIMITS[tier].weeklyWorksheets === null;
}

/**
 * Abuse rate limit — orthogonal to the plan gate and applied to EVERY tier
 * (an unlimited plan still can't hammer the generator). A human composing
 * sessions cannot approach this; a script can. Sliding window, in seconds.
 */
export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_SEC = 60;

/** True if another generation is allowed under the sliding rate window. */
export function withinRateLimit(
  generatedAt: Date[],
  now: Date,
  max = RATE_LIMIT_MAX,
  windowSec = RATE_LIMIT_WINDOW_SEC,
): boolean {
  const start = now.getTime() - windowSec * 1000;
  const recent = generatedAt.filter((d) => d.getTime() > start).length;
  return recent < max;
}

/** Children this tier may have. */
export function childLimit(tier: PlanTier): number {
  return PLAN_LIMITS[tier].children;
}

/** Whether an account on `tier` with `currentCount` children may add one more. */
export function canAddChild(tier: PlanTier, currentCount: number): boolean {
  return currentCount < childLimit(tier);
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
  const limit = input.limit ?? PLAN_LIMITS[input.tier].weeklyWorksheets ?? FREE_WEEKLY_LIMIT;
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

/**
 * Whether a weekly pack of `worksheetCount` worksheets fits the account's
 * remaining free allowance (Sprint 8 M2). All-or-nothing on purpose: a 7-day
 * pack that would exceed the free cap is declined whole and shown the upgrade
 * notice, never truncated into a partial pack. Unlimited tiers always fit.
 */
export function packFits(allowance: Allowance, worksheetCount: number): boolean {
  return allowance.unlimited || allowance.remaining >= worksheetCount;
}
