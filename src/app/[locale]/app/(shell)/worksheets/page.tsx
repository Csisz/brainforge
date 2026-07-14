import { setRequestLocale, getTranslations } from "next-intl/server";
import { allGenerators } from "@/lib/worksheets/registry";
import { composeWorksheet, defaultRenderOptions } from "@/lib/worksheets/page";
import { getChildren } from "@/lib/children/queries";
import { CatalogPrintAction } from "@/components/worksheets/catalog-print-action";
import { Badge } from "@/components/ui/badge";
import type { Age, Difficulty, ThemeId } from "@/lib/worksheets/types";

// Stable, self-documenting previews: fixed seed per generator id so the catalog
// looks the same on every visit, at an age/difficulty representative of the app.
const PREVIEW_AGE: Age = 5;
const PREVIEW_DIFFICULTY: Difficulty = 3;
const PREVIEW_THEME: ThemeId = "nature";

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
    const { svg } = composeWorksheet(
      { generatorId: g.id, generatorVersion: g.version, params: null, seed: `catalog-${g.id}` },
      ctx,
    );
    return { id: g.id, svg, goals: g.goals, ageRange: g.ageRange };
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
            {/* Cap the A4-tall preview to the recognizable top of the sheet so cards stay scannable. */}
            <div className="relative h-56 overflow-hidden border-b border-line bg-white p-2 [&>svg]:h-auto [&>svg]:w-full">
              {/* Trusted output: composeWorksheet() is our own deterministic renderer. */}
              <div dangerouslySetInnerHTML={{ __html: card.svg }} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <h2 className="font-display text-base font-bold text-ink">{t(`generators.${card.id}`)}</h2>
                <p className="mt-1 text-sm leading-snug text-ink-soft">{t(`generatorDescriptions.${card.id}`)}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-soft">{tc("trainsLabel")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {card.goals.map((goal) => (
                    <Badge key={goal} variant="outline" className="border-line text-ink-soft">
                      {t(`goals.${goal}`)}
                    </Badge>
                  ))}
                </div>
              </div>

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
