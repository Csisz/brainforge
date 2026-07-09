import type { GeneratorContext, Difficulty, ThemeId, PaperSize } from "@/lib/worksheets/types";
import { defaultRenderOptions } from "@/lib/worksheets/page";
import { ageFromBirthMonth } from "@/lib/children/age";
import type { ChildRow } from "@/lib/children/queries";

/**
 * Reconstructs the exact GeneratorContext (minus rng) a worksheet was composed
 * with, from its owning child + session — needed because `worksheets.params`
 * is stored null ("defaultParams at render time"; README/engine.ts), so
 * re-deriving identical params on every render depends on reproducing the
 * same age/difficulty/theme/render-options every time.
 *
 * Paper size is deliberately NOT part of that reproducibility contract: it's
 * a page-composer presentation choice (page.ts scales fixed content geometry
 * to fit whichever paper), not generator input, so it's safe to read from the
 * account's current preference rather than freeze it at generation time.
 */
export function buildWorksheetRenderContext(
  child: ChildRow,
  session: { difficulty: number; theme: string },
  locale: string,
  paperSize: PaperSize = "a4",
): Omit<GeneratorContext, "rng"> {
  const accessibility = child.accessibility ?? {};
  return {
    age: ageFromBirthMonth(child.birth_month),
    difficulty: session.difficulty as Difficulty,
    theme: session.theme as ThemeId,
    render: {
      ...defaultRenderOptions(locale),
      paper: paperSize,
      lowInk: accessibility.lowInk ?? false,
      highContrast: accessibility.highContrast ?? false,
      motorSupport: accessibility.motorSupport ?? false,
    },
  };
}
