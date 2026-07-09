import type { Age, Difficulty } from "@/lib/worksheets/types";

/** Age-based default; the wizard's manual slider can override it (PRD §7 — adaptive layer replaces this later). */
export function defaultDifficulty(age: Age): Difficulty {
  if (age <= 3) return 1;
  if (age <= 5) return 2;
  if (age <= 7) return 3;
  if (age <= 9) return 4;
  return 5;
}
