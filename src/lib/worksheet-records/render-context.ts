import type { GeneratorContext, Difficulty, ThemeId } from "@/lib/worksheets/types";
import { defaultRenderOptions } from "@/lib/worksheets/page";
import { ageFromBirthMonth } from "@/lib/children/age";
import type { ChildRow } from "@/lib/children/queries";

/**
 * Reconstructs the exact GeneratorContext (minus rng) a worksheet was composed
 * with, from its owning child + session — needed because `worksheets.params`
 * is stored null ("defaultParams at render time"; README/engine.ts), so
 * re-deriving identical params on every render depends on reproducing the
 * same age/difficulty/theme/render-options every time.
 */
export function buildWorksheetRenderContext(
  child: ChildRow,
  session: { difficulty: number; theme: string },
  locale: string,
): Omit<GeneratorContext, "rng"> {
  const accessibility = child.accessibility ?? {};
  return {
    age: ageFromBirthMonth(child.birth_month),
    difficulty: session.difficulty as Difficulty,
    theme: session.theme as ThemeId,
    render: {
      ...defaultRenderOptions(locale),
      lowInk: accessibility.lowInk ?? false,
      highContrast: accessibility.highContrast ?? false,
      motorSupport: accessibility.motorSupport ?? false,
    },
  };
}
