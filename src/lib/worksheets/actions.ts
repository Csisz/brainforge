"use server";

import { allGenerators } from "./registry";
import { composeWorksheet, defaultRenderOptions } from "./page";
import { createRng, freshSeed } from "@/lib/random";
import type { Age, Difficulty, ThemeId } from "./types";
import type { GalleryItem } from "./gallery-types";

/**
 * Marketing-page rendering (landing gallery). Kept server-side per the
 * engine's rendering rule; the hero demo is the one deliberate exception
 * (README: "the hero demo may render client-side — the engine is isomorphic").
 */
const DEMO_AGE: Age = 5;
const DEMO_DIFFICULTY: Difficulty = 3;
const DEMO_THEME: ThemeId = "nature";

export async function regenerateGallery(locale: string): Promise<GalleryItem[]> {
  const ctx = {
    age: DEMO_AGE,
    difficulty: DEMO_DIFFICULTY,
    theme: DEMO_THEME,
    render: defaultRenderOptions(locale),
  };
  return allGenerators().map((generator) => {
    const seed = freshSeed();
    const { svg } = composeWorksheet(
      { generatorId: generator.id, generatorVersion: generator.version, params: null, seed },
      ctx,
    );
    return { generatorId: generator.id, seed, svg };
  });
}

export async function pickHeroWorksheet(locale: string): Promise<GalleryItem> {
  const rng = createRng(freshSeed());
  const generator = rng.pick(allGenerators());
  const seed = freshSeed();
  const ctx = {
    age: DEMO_AGE,
    difficulty: DEMO_DIFFICULTY,
    theme: DEMO_THEME,
    render: defaultRenderOptions(locale),
  };
  const { svg } = composeWorksheet(
    { generatorId: generator.id, generatorVersion: generator.version, params: null, seed },
    ctx,
  );
  return { generatorId: generator.id, seed, svg };
}
