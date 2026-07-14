import type { Age, DevelopmentGoal } from "@/lib/worksheets/types";
import { GOALS } from "@/lib/worksheets/goal-list";

const ALL_GOALS: DevelopmentGoal[] = GOALS.map((g) => g.id);

/** Sensible starting goals when a child has no session history yet (PRD §3, age bands). */
export function ageTypicalGoals(age: Age): DevelopmentGoal[] {
  if (age <= 4) return ["fine_motor", "attention", "pre_writing"];
  if (age <= 6) return ["pre_writing", "visual_perception", "math_thinking"];
  return ["executive_function", "problem_solving", "math_thinking"];
}

/**
 * The three goals a child's recent sessions have covered least — the gentle
 * "try these next" nudge (Sprint 3 M4). With no history, falls back to
 * age-typical defaults. Ties break by registry order for a stable render.
 */
export function lowestCoverageGoals(sessionGoals: DevelopmentGoal[][], age: Age): DevelopmentGoal[] {
  if (sessionGoals.length === 0) return ageTypicalGoals(age);

  const count = new Map<DevelopmentGoal, number>(ALL_GOALS.map((g) => [g, 0]));
  for (const goals of sessionGoals) {
    for (const g of goals) count.set(g, (count.get(g) ?? 0) + 1);
  }

  return [...ALL_GOALS]
    .sort((a, b) => count.get(a)! - count.get(b)! || ALL_GOALS.indexOf(a) - ALL_GOALS.indexOf(b))
    .slice(0, 3);
}
