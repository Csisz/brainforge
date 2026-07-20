import type { ThemeId } from "@/lib/worksheets/types";

/**
 * Weekly-pack input types. Kept out of the "use server" actions file so it
 * exports only async functions. PackDays is also imported by the pack form.
 */
export type PackDays = 3 | 5 | 7;

export type CreatePackInput = {
  childId: string;
  days: PackDays;
  durationMin: 10 | 20 | 30 | 45;
  theme: ThemeId;
  locale: string;
};
