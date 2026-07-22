import { z } from "zod";
import { zUuid, zLocale, zTheme, zDurationMin } from "@/lib/validation/common";

/** Runtime validation for createPack (Stability B2). Mirrors CreatePackInput —
 *  `days` is the fixed 3/5/7 ladder; `packId` is the client idempotency key (B1). */
export const createPackSchema = z.object({
  childId: zUuid,
  days: z.union([z.literal(3), z.literal(5), z.literal(7)]),
  durationMin: zDurationMin,
  theme: zTheme,
  packId: zUuid,
  locale: zLocale,
});
