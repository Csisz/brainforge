"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Shuffle } from "lucide-react";
import { allGenerators } from "@/lib/worksheets/registry";
import { composeWorksheet, defaultRenderOptions } from "@/lib/worksheets/page";
import { createRng, freshSeed } from "@/lib/random";
import type { Age, Difficulty, ThemeId } from "@/lib/worksheets/types";
import { Button } from "@/components/ui/button";
import { SeedChip } from "./seed-chip";

const DEMO_AGE: Age = 5;
const DEMO_DIFFICULTY: Difficulty = 3;
const DEMO_THEME: ThemeId = "nature";

export type HeroWorksheet = { generatorId: string; seed: string; svg: string };

/**
 * The signature element: a real worksheet rendered by composeWorksheet(),
 * regenerated instantly on click. This is the one place in the app the
 * engine is allowed to render client-side (README: the engine is isomorphic;
 * everywhere else worksheets render server-side).
 */
export function HeroDemo({ locale, initial }: { locale: string; initial: HeroWorksheet }) {
  const t = useTranslations("hero");
  const [worksheet, setWorksheet] = useState(initial);

  function regenerate() {
    const rng = createRng(freshSeed());
    const generator = rng.pick(allGenerators());
    const seed = freshSeed();
    const { svg } = composeWorksheet(
      { generatorId: generator.id, generatorVersion: generator.version, params: null, seed },
      { age: DEMO_AGE, difficulty: DEMO_DIFFICULTY, theme: DEMO_THEME, render: defaultRenderOptions(locale) },
    );
    setWorksheet({ generatorId: generator.id, seed, svg });
  }

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-4">
      <div
        key={worksheet.seed}
        className="motion-reduce:animate-none motion-reduce:transition-none w-full max-w-sm rotate-1 rounded-card border border-line bg-card p-3 shadow-soft duration-150 animate-in fade-in slide-in-from-bottom-2"
      >
        {/* Trusted output: composeWorksheet() is our own deterministic renderer, not user input. */}
        <div
          className="overflow-hidden rounded-[calc(var(--radius-card)-0.5rem)] bg-white [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: worksheet.svg }}
        />
      </div>
      <div className="flex w-full max-w-sm items-center justify-between gap-3">
        <SeedChip seed={worksheet.seed} />
        <Button size="sm" variant="secondary" onClick={regenerate} className="gap-1.5">
          <Shuffle className="size-3.5" aria-hidden="true" />
          {t("regenerate")}
        </Button>
      </div>
    </div>
  );
}
