import type { Age } from "@/lib/worksheets/types";

/** Whole years since birth_month (a "YYYY-MM-01" date), clamped to the supported Age range. */
export function ageFromBirthMonth(birthMonth: string): Age {
  const birth = new Date(birthMonth);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth()) years -= 1;
  return Math.min(10, Math.max(2, years)) as Age;
}
