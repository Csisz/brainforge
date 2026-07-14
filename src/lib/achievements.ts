import { Sparkles, Printer, Flame, Trophy, Compass, Hand, type LucideIcon } from "lucide-react";

/**
 * ACHIEVEMENTS CATALOG
 * --------------------
 * The kinds are a code catalog (the DB stores only the kind string, with a
 * unique(child_id, kind) constraint for idempotent awarding). Each kind has a
 * line-art icon; the localized name + playful description live in next-intl
 * messages under `achievements.<kind>`.
 *
 * Awarding is pure and monotonic: `evaluateAchievements` returns every kind a
 * child currently qualifies for from their history, so re-running it is safe
 * (already-earned rows are ignored on insert). No icon or string logic here
 * touches the DB, so this module is importable from client and server alike.
 */

export const ACHIEVEMENT_KINDS = [
  "first_session",
  "first_print",
  "streak_3",
  "streak_7",
  "explorer_5_types",
  "bilateral_master",
] as const;

export type AchievementKind = (typeof ACHIEVEMENT_KINDS)[number];

export const ACHIEVEMENT_ICON: Record<AchievementKind, LucideIcon> = {
  first_session: Sparkles,
  first_print: Printer,
  streak_3: Flame,
  streak_7: Trophy,
  explorer_5_types: Compass,
  bilateral_master: Hand,
};

/** Everything needed to decide a child's achievements — no DB types leak in. */
export type AchievementFacts = {
  /** Calendar days (YYYY-MM-DD) on which the child completed a session. */
  completedSessionDays: string[];
  /** generatorId of every worksheet ever created for the child. */
  worksheetGeneratorIds: string[];
};

/** Longest run of consecutive calendar days present in the list. */
export function longestConsecutiveRun(days: string[]): number {
  const uniq = [...new Set(days)].sort();
  if (uniq.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < uniq.length; i++) {
    const prev = Date.parse(uniq[i - 1]! + "T00:00:00Z");
    const now = Date.parse(uniq[i]! + "T00:00:00Z");
    const diffDays = Math.round((now - prev) / 86_400_000);
    if (diffDays === 1) cur += 1;
    else if (diffDays > 1) cur = 1;
    // diffDays === 0 (duplicate) can't happen after dedupe, but is a no-op.
    if (cur > best) best = cur;
  }
  return best;
}

/** Every achievement the child currently qualifies for (order = catalog order). */
export function evaluateAchievements(facts: AchievementFacts): AchievementKind[] {
  const earned: AchievementKind[] = [];
  const run = longestConsecutiveRun(facts.completedSessionDays);
  const distinctTypes = new Set(facts.worksheetGeneratorIds).size;
  const dualCount = facts.worksheetGeneratorIds.filter((id) => id.startsWith("dual_")).length;

  if (facts.completedSessionDays.length >= 1) earned.push("first_session");
  if (facts.worksheetGeneratorIds.length >= 1) earned.push("first_print");
  if (run >= 3) earned.push("streak_3");
  if (run >= 7) earned.push("streak_7");
  if (distinctTypes >= 5) earned.push("explorer_5_types");
  if (dualCount >= 5) earned.push("bilateral_master");

  // Return in catalog order for a stable render.
  return ACHIEVEMENT_KINDS.filter((k) => earned.includes(k));
}
