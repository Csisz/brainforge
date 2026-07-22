import { z } from "zod";
import {
  zUuid, zLocale, zGoal, zTheme, zMaterial, zDifficultyLevel, zDurationMin,
} from "@/lib/validation/common";

/**
 * Runtime validation for startSession (Stability B2). Mirrors StartSessionInput.
 * `difficulty` is nullable — null means "let calibration pick a level per goal".
 * `materials` may be empty (the composer degrades gracefully with none).
 */
export const startSessionSchema = z.object({
  childId: zUuid,
  goals: z.array(zGoal).min(1).max(11),
  theme: zTheme,
  durationMin: zDurationMin,
  materials: z.array(zMaterial).max(10),
  difficulty: zDifficultyLevel.nullable(),
  idempotencyKey: zUuid,
  locale: zLocale,
});
