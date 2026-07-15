import type { Age, Difficulty, DevelopmentGoal } from "@/lib/worksheets/types";
import { defaultDifficulty } from "@/lib/activities/difficulty";

/**
 * ADAPTIVE CALIBRATION ENGINE (PRD §7) — success-first.
 *
 * The design principle is not "keep the child in the flow channel". It is:
 * **optimize for the child's sense of success, not for challenge.** Difficulty
 * rises only while success persists; retreat is fast, progress is deliberate.
 * Every asymmetry below follows from that and is deliberate, not an oversight:
 *
 *  - A step DOWN needs one bad session and no waiting period. A step UP needs
 *    two good ones in a row and a 7-day gate. Getting it wrong upward costs a
 *    child their confidence; getting it wrong downward costs them an easy
 *    afternoon. Those are not symmetric mistakes, so the rules are not either.
 *  - Cold start is the age default MINUS ONE. A first impression must be
 *    winnable; we would rather a child's first sheet be too easy than have them
 *    decide on day one that this is a thing they are bad at.
 *  - Boredom (nailed it, but no fun) does NOT raise the level. Bored is not the
 *    same as ready — raising difficulty at someone who is disengaged just makes
 *    it harder to be bored at. Rotate the material instead.
 *  - A step-down sets `pendingAnchor`, so the next session leads with the
 *    generator this child does best. We follow a hard moment with a guaranteed
 *    win, not another unknown.
 *
 * This module is pure and total: no clock, no DB, no randomness. `now` is an
 * argument. The server loads rows, calls `calibrate`, and writes the result.
 */

/** Days a level must hold before it can rise again. */
export const STEP_UP_COOLDOWN_DAYS = 7;
/** At or below this, the session was too hard — retreat. */
export const STRUGGLE_BELOW = 0.5;
/** At or above this, the child succeeded. */
export const SUCCESS_AT_LEAST = 0.8;
/** Enjoyment at or above this means "and they liked it". */
export const ENJOYED_AT_LEAST = 4;
/** Enjoyment at or below this, despite success, means bored. */
export const BORED_AT_MOST = 2;
/** Consecutive good sessions required to earn a step up. */
export const STEP_UP_STREAK = 2;

/** Persisted calibration for one (child, goal). */
export type Calibration = {
  level: Difficulty;
  lastStepUpAt: Date | null;
  pendingAnchor: boolean;
};

/**
 * One past session's outcome for a single goal, aggregated from its worksheet
 * slots. Newest first. `successRate` is null when the parent gave no signal.
 */
export type GoalOutcome = {
  sessionId: string;
  successRate: number | null;
  enjoyment: number | null;
  completed: boolean;
};

export type CalibrationInput = {
  now: Date;
  age: Age;
  /** null ⇒ cold start. */
  current: Calibration | null;
  /** Outcomes for this (child, goal), newest first. */
  recent: GoalOutcome[];
};

export type CalibrationChange = "step_down" | "step_up" | "none";

export type CalibrationDecision = {
  level: Difficulty;
  lastStepUpAt: Date | null;
  pendingAnchor: boolean;
  /** What happened, for microcopy — never rendered as a number to a parent. */
  change: CalibrationChange;
  /**
   * Success without enjoyment: keep the level, change the material. The session
   * composer excludes this goal's recently-used generators when set.
   */
  rotateVariety: boolean;
};

const clamp = (n: number): Difficulty => Math.min(5, Math.max(1, Math.round(n))) as Difficulty;

/**
 * The level a child starts a goal at: one below their age default, floored at 1.
 * Exported because the cold-start rule is a product promise, not an
 * implementation detail — the composer and tests both assert on it.
 */
export function coldStartLevel(age: Age): Difficulty {
  return clamp(defaultDifficulty(age) - 1);
}

const daysBetween = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 86_400_000;

/** Did this outcome show the child struggling? */
function struggled(o: GoalOutcome): boolean {
  if (!o.completed) return true;
  return o.successRate !== null && o.successRate < STRUGGLE_BELOW;
}

/** Did this outcome show success *and* enjoyment? */
function thrived(o: GoalOutcome): boolean {
  return (
    o.completed &&
    o.successRate !== null &&
    o.successRate >= SUCCESS_AT_LEAST &&
    o.enjoyment !== null &&
    o.enjoyment >= ENJOYED_AT_LEAST
  );
}

/** Succeeded, but wasn't having a good time. */
function bored(o: GoalOutcome): boolean {
  return (
    o.completed &&
    o.successRate !== null &&
    o.successRate >= SUCCESS_AT_LEAST &&
    o.enjoyment !== null &&
    o.enjoyment <= BORED_AT_MOST
  );
}

/**
 * Decide this (child, goal)'s next level. Pure: same inputs, same answer.
 *
 * Rule order is load-bearing. Struggle is checked first and returns
 * immediately, so a child having a hard time is never held at a level by a
 * cooldown or talked out of a retreat by an older good streak.
 */
export function calibrate(input: CalibrationInput): CalibrationDecision {
  const current: Calibration = input.current ?? {
    level: coldStartLevel(input.age),
    lastStepUpAt: null,
    pendingAnchor: false,
  };
  const base: CalibrationDecision = {
    level: current.level,
    lastStepUpAt: current.lastStepUpAt,
    pendingAnchor: current.pendingAnchor,
    change: "none",
    rotateVariety: false,
  };

  const latest = input.recent[0];
  if (!latest) return base; // cold start, or nothing to learn from yet

  // 1. STEP DOWN — immediate, unconditional, no cooldown.
  if (struggled(latest)) {
    return {
      ...base,
      level: clamp(current.level - 1),
      // Anchor the next session even if we were already at level 1 and could
      // not drop further: the child still had a hard time, and the guaranteed
      // win is the point, not the number.
      pendingAnchor: true,
      change: "step_down",
    };
  }

  // 2. STEP UP — deliberate: a streak AND a cooldown.
  const streak = input.recent.slice(0, STEP_UP_STREAK);
  const earnedStreak = streak.length === STEP_UP_STREAK && streak.every(thrived);
  const cooledDown =
    current.lastStepUpAt === null || daysBetween(input.now, current.lastStepUpAt) > STEP_UP_COOLDOWN_DAYS;

  if (earnedStreak && cooledDown && current.level < 5) {
    return {
      ...base,
      level: clamp(current.level + 1),
      lastStepUpAt: input.now,
      change: "step_up",
    };
  }

  // 3. BOREDOM — never a level change; change the material instead.
  if (bored(latest)) return { ...base, rotateVariety: true };

  // 4. Otherwise hold. Steady is a valid answer.
  return base;
}

/**
 * Difficulty to compose a goal's worksheets at.
 * Falls back to the cold-start level so a goal with no row is still winnable.
 */
export function levelForGoal(
  calibrationByGoal: Partial<Record<DevelopmentGoal, Difficulty>>,
  goal: DevelopmentGoal,
  age: Age,
): Difficulty {
  return calibrationByGoal[goal] ?? coldStartLevel(age);
}
