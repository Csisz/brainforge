import { z } from "zod";
import { zSlotKind, zEase, zEnjoyment } from "@/lib/validation/common";

/**
 * Runtime validation for submitSessionFeedback (Stability B2). Mirrors
 * SlotFeedback[]. `enjoyment` is nullable (no rating given); `ease` is present
 * only on worksheet slots and may be null. The upper bound is a generous guard —
 * a real session has a handful of slots, never dozens.
 */
export const slotFeedbackSchema = z.object({
  slotIndex: z.number().int().min(0).max(63),
  slotKind: zSlotKind,
  completed: z.boolean(),
  enjoyment: zEnjoyment.nullable(),
  ease: zEase.nullable().optional(),
});

export const sessionFeedbackSchema = z.array(slotFeedbackSchema).min(1).max(64);
