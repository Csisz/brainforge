import type { Age } from "@/lib/worksheets/types";

/** Whole years since birth_month (a "YYYY-MM-01" date), clamped to the supported Age range. */
export function ageFromBirthMonth(birthMonth: string): Age {
  const birth = new Date(birthMonth);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth()) years -= 1;
  return Math.min(10, Math.max(2, years)) as Age;
}

/**
 * Validates a birth month chosen in onboarding: a "YYYY-MM" string that must be
 * a real month, not in the future, and that puts the child in the 0–10 age
 * range at save time. `now` is injectable so the check is deterministic in tests.
 * (Unlike ageFromBirthMonth, this must NOT clamp — it has to reject an 11-year-old.)
 */
export function isValidBirthMonth(birthMonth: string, now: Date = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(birthMonth);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return false;

  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1–12
  // Not in the future — the current month is allowed (age 0).
  if (year > curYear || (year === curYear && month > curMonth)) return false;

  let age = curYear - year;
  if (curMonth < month) age -= 1; // birthday not yet reached this year
  return age >= 0 && age <= 10;
}
