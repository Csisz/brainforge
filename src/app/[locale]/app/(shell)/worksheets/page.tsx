import { setRequestLocale, getTranslations } from "next-intl/server";
import { allGenerators } from "@/lib/worksheets/registry";
import { composeWorksheet, defaultRenderOptions } from "@/lib/worksheets/page";
import { getChildren } from "@/lib/children/queries";
import { CatalogPrintAction } from "@/components/worksheets/catalog-print-action";
import { GoalOutcomes } from "@/components/goals/goal-outcomes";
import { Badge } from "@/components/ui/badge";
import type { Age, Difficulty, ThemeId } from "@/lib/worksheets/types";

// Stable, self-documenting previews: fixed seed per generator id so the catalog
// looks the same on every visit, at an age/difficulty representative of the app.
const PREVIEW_AGE: Age = 5;
const PREVIEW_DIFFICULTY: Difficulty = 3;
const PREVIEW_THEME: ThemeId = "nature";

// Each preview takes its sheet's own shape — generators author anything from
// tall portrait to wide landscape, and a fixed frame would letterbox the
// extremes into a void. Clamped so a future outlier can't produce a card that
// is a sliver or a tower; card *width* stays uniform, only height varies.
const ASPECT_MIN = 3 / 4; // 0.75 — tallest allowed (portrait sheet)
const ASPECT_MAX = 16 / 10; // 1.6 — widest allowed
const frameAspect = (box: { width: number; height: number }) =>
  Math.min(ASPECT_MAX, Math.max(ASPECT_MIN, box.width / box.height));

export default async function WorksheetsCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tc = await getTranslations("worksheetsCatalog");

  const children = await getChildren();
  const childOptions = children.map((c) => ({ id: c.id, nickname: c.nickname }));

  const ctx = {
    age: PREVIEW_AGE,
    difficulty: PREVIEW_DIFFICULTY,
    theme: PREVIEW_THEME,
    render: defaultRenderOptions(locale),
  };

  const cards = allGenerators().map((g) => {
    // Thumbnail mode: the task itself fills the card, not the top of an A4 sheet.
    const { svg, box } = composeWorksheet(
      { generatorId: g.id, generatorVersion: g.version, params: null, seed: `catalog-${g.id}` },
      ctx,
      {},
      { thumbnail: true },
    );
    return { id: g.id, svg, goals: g.goals, ageRange: g.ageRange, aspect: frameAspect(box!) };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink">{tc("title")}</h1>
        <p className="mt-1 text-ink-soft">{tc("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className="flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-soft"
          >
            {/* Sheet-like frame shaped to this sheet — no crop, no letterbox void. */}
            <div
              style={{ aspectRatio: String(card.aspect) }}
              className="overflow-hidden border-b border-line bg-white p-3"
            >
              {/* Trusted output: composeWorksheet() is our own deterministic renderer. */}
              <div
                className="h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: card.svg }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <h2 className="font-display text-base font-bold text-ink">{t(`generators.${card.id}`)}</h2>
                <p className="mt-1 text-sm leading-snug text-ink-soft">{t(`generatorDescriptions.${card.id}`)}</p>
              </div>

              {/* Collection sheets (reward_chart) train nothing — the description
                  carries their meaning, so the taxonomy/outcome row is skipped. */}
              {card.goals.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-ink-soft">{tc("trainsLabel")}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {card.goals.map((goal) => (
                      <Badge key={goal} variant="outline" className="border-line text-ink-soft">
                        {t(`goals.${goal}`)}
                      </Badge>
                    ))}
                  </div>
                  <GoalOutcomes
                    label={tc("helpsWith")}
                    outcomes={[
                      ...new Set(card.goals.flatMap((goal) => t.raw(`goalOutcomes.${goal}`) as string[])),
                    ].slice(0, 4)}
                    className="mt-0.5"
                  />
                </div>
              )}

              <p className="text-xs text-ink-soft">
                {tc("ageRange", { from: card.ageRange[0], to: card.ageRange[1] })}
              </p>

              <div className="mt-auto pt-1">
                <CatalogPrintAction generatorId={card.id} childOptions={childOptions} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
