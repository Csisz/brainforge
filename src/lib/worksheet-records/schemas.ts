import { z } from "zod";
import { zUuid, zLocale, zRewardFamily } from "@/lib/validation/common";
import { allGenerators } from "@/lib/worksheets/registry";

/**
 * Runtime validation for the session-less print actions (Stability B2).
 *
 * `generatorId` is constrained to real, REGISTERED ids (derived from the registry
 * so it can never drift): an unknown id becomes a clean invalid_input instead of
 * the uncaught throw getGenerator would otherwise raise. `family` null ⇒
 * "surprise" (the generator picks from the seed).
 */
const GENERATOR_IDS = allGenerators().map((g) => g.id) as [string, ...string[]];

export const printWorksheetSchema = z.object({
  generatorId: z.enum(GENERATOR_IDS),
  childId: zUuid,
  locale: zLocale,
});

export const printRewardChartSchema = z.object({
  childId: zUuid,
  family: zRewardFamily.nullable(),
  locale: zLocale,
});
