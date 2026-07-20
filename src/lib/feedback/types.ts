import type { SessionSlot } from "@/lib/activities/engine";
import type { Ease } from "./ease";

/**
 * The per-slot feedback payload the session view sends to submitSessionFeedback.
 * Lives here, not in the "use server" actions file, so that module can export
 * only async functions (its sole invariant — a stray value export breaks the
 * action at runtime). Types are compile-time only, but we keep the actions file
 * pure so the rule is trivially enforceable.
 */
export type SlotFeedback = {
  slotIndex: number;
  slotKind: SessionSlot["kind"];
  completed: boolean;
  enjoyment: number | null;
  /** Worksheet slots only — drives adaptive calibration. */
  ease?: Ease | null;
};
