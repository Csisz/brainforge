import type { CalibrationRow } from "./queries";

/**
 * Which line, if any, to show a parent about their child's calibration.
 *
 * The step-down line wins over the step-up line when both are true. A parent
 * whose child just had a hard time needs the calming sentence more than they
 * need a celebration about a different goal — and stacking both would read as
 * a scorecard, which is exactly what this must never be.
 *
 * Derived from the row rather than stored: `pending_anchor` means we stepped
 * down and the next session still owes a win, and a fresh `last_step_up_at`
 * means we just moved up. Neither needs a column of its own.
 */
export type AdaptiveNote = "stepDown" | "stepUp" | null;

/** How long a step-up stays worth mentioning. */
const CELEBRATE_FOR_MS = 24 * 60 * 60 * 1000;

export function adaptiveNote(rows: CalibrationRow[], now = new Date()): AdaptiveNote {
  if (rows.some((r) => r.pending_anchor)) return "stepDown";
  const justRose = rows.some(
    (r) => r.last_step_up_at && now.getTime() - Date.parse(r.last_step_up_at) < CELEBRATE_FOR_MS,
  );
  return justRose ? "stepUp" : null;
}
