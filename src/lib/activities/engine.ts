import type { Age, DevelopmentGoal, Difficulty, ThemeId, WorksheetRecipe } from "@/lib/worksheets/types";
import { findGenerators } from "@/lib/worksheets/registry";
import { createRng, freshSeed } from "@/lib/random";

/**
 * ACTIVITY ENGINE v1 — rule-based session composer (PRD §8).
 *
 * Composes the "one-click daily plan": warm-up → movement → worksheet →
 * memory game → creative task → reward → reflection. v1 is deterministic
 * and rule-based; the AI layer (src/lib/ai) later enriches slots with
 * themed narrative text, and the adaptive layer replaces the difficulty
 * heuristic with per-child calibration. The slot structure is stable so
 * both can plug in without changing this contract.
 */

export type SessionRequest = {
  childId: string;
  age: Age;
  goals: DevelopmentGoal[];
  theme: ThemeId;
  durationMin: 10 | 20 | 30 | 45;
  materials: MaterialId[];
  difficulty: Difficulty;
  /** (generatorId, paramsHash) pairs used recently — never repeat (PRD §6). */
  recentWorksheets: Array<{ generatorId: string; seed: string }>;
  locale: string;
};

export type MaterialId =
  | "pencil" | "crayons" | "scissors" | "glue" | "paper"
  | "ball" | "cups" | "blocks" | "tape" | "dice";

export type SessionSlot =
  | { kind: "warmup"; activityKey: string; minutes: number }
  | { kind: "movement"; activityKey: string; minutes: number }
  | { kind: "worksheet"; recipe: WorksheetRecipe; minutes: number }
  | { kind: "memory_game"; activityKey: string; minutes: number }
  | { kind: "creative"; activityKey: string; minutes: number }
  | { kind: "reward"; activityKey: string; minutes: number }
  | { kind: "reflection"; activityKey: string; minutes: number };

export type SessionPlan = {
  slots: SessionSlot[];
  totalMinutes: number;
};

/**
 * Screen-free activity pools (PRD §4 physical activities). Keys resolve to
 * localized, theme-adapted instructions — text personalization is exactly
 * where the LLM layer plugs in later; the *selection* stays rule-based.
 * Each entry lists required materials so we never suggest what the family
 * doesn't have.
 */
const PHYSICAL_POOL: Record<"warmup" | "movement" | "memory_game" | "creative" | "reward" | "reflection", Array<{ key: string; materials: MaterialId[]; minAge: Age }>> = {
  warmup: [
    { key: "activity.warmup.simon_says", materials: [], minAge: 3 },
    { key: "activity.warmup.finger_gym", materials: [], minAge: 2 },
    { key: "activity.warmup.rhythm_copy", materials: [], minAge: 3 },
  ],
  movement: [
    { key: "activity.movement.cross_crawl", materials: [], minAge: 4 },
    { key: "activity.movement.ball_target", materials: ["ball"], minAge: 3 },
    { key: "activity.movement.obstacle_course", materials: ["tape"], minAge: 3 },
    { key: "activity.movement.animal_walks", materials: [], minAge: 2 },
  ],
  memory_game: [
    { key: "activity.memory.cup_shuffle", materials: ["cups"], minAge: 3 },
    { key: "activity.memory.whats_missing", materials: [], minAge: 3 },
    { key: "activity.memory.sound_sequence", materials: [], minAge: 4 },
  ],
  creative: [
    { key: "activity.creative.build_story", materials: ["blocks"], minAge: 3 },
    { key: "activity.creative.draw_theme", materials: ["crayons", "paper"], minAge: 2 },
    { key: "activity.creative.cut_collage", materials: ["scissors", "glue", "paper"], minAge: 4 },
  ],
  reward: [
    { key: "activity.reward.sticker_moment", materials: [], minAge: 2 },
    { key: "activity.reward.victory_dance", materials: [], minAge: 2 },
  ],
  reflection: [
    { key: "activity.reflection.favorite_part", materials: [], minAge: 3 },
    { key: "activity.reflection.show_and_tell", materials: [], minAge: 2 },
  ],
};

/** Time templates per session length — worksheet share grows with duration. */
const TEMPLATES: Record<SessionRequest["durationMin"], Array<{ kind: SessionSlot["kind"]; minutes: number }>> = {
  10: [
    { kind: "warmup", minutes: 2 },
    { kind: "worksheet", minutes: 6 },
    { kind: "reward", minutes: 2 },
  ],
  20: [
    { kind: "warmup", minutes: 3 },
    { kind: "movement", minutes: 4 },
    { kind: "worksheet", minutes: 8 },
    { kind: "reward", minutes: 2 },
    { kind: "reflection", minutes: 3 },
  ],
  30: [
    { kind: "warmup", minutes: 3 },
    { kind: "movement", minutes: 5 },
    { kind: "worksheet", minutes: 10 },
    { kind: "memory_game", minutes: 6 },
    { kind: "reward", minutes: 2 },
    { kind: "reflection", minutes: 4 },
  ],
  45: [
    { kind: "warmup", minutes: 4 },
    { kind: "movement", minutes: 7 },
    { kind: "worksheet", minutes: 12 },
    { kind: "memory_game", minutes: 8 },
    { kind: "creative", minutes: 8 },
    { kind: "reward", minutes: 2 },
    { kind: "reflection", minutes: 4 },
  ],
};

export function composeSession(req: SessionRequest): SessionPlan {
  // Deterministic per request-shape but fresh per call: the seed mixes a
  // fresh random component, so two sessions today differ, yet the plan can
  // be regenerated from its stored seed.
  const sessionSeed = freshSeed();
  const rng = createRng(`session:${req.childId}:${sessionSeed}`);

  const template = TEMPLATES[req.durationMin];
  const usedKeys = new Set<string>();

  const slots: SessionSlot[] = template.map((slot) => {
    if (slot.kind === "worksheet") {
      return { kind: "worksheet", recipe: pickWorksheet(req, rng), minutes: slot.minutes };
    }
    const pool = PHYSICAL_POOL[slot.kind].filter(
      (a) => a.minAge <= req.age && a.materials.every((m) => req.materials.includes(m)) && !usedKeys.has(a.key),
    );
    const fallback = PHYSICAL_POOL[slot.kind].filter((a) => a.materials.length === 0 && a.minAge <= req.age);
    const chosen = rng.pick(pool.length ? pool : fallback);
    usedKeys.add(chosen.key);
    return { kind: slot.kind, activityKey: chosen.key, minutes: slot.minutes } as SessionSlot;
  });

  return { slots, totalMinutes: template.reduce((s, t) => s + t.minutes, 0) };
}

function pickWorksheet(req: SessionRequest, rng: ReturnType<typeof createRng>): WorksheetRecipe {
  const goal = rng.pick(req.goals);
  const candidates = findGenerators({ goal, age: req.age });
  const pool = candidates.length ? candidates : findGenerators({ age: req.age });

  // Anti-repetition (PRD §6): deprioritize generators used recently.
  const recentIds = new Set(req.recentWorksheets.map((w) => w.generatorId));
  const freshPool = pool.filter((g) => !recentIds.has(g.id));
  const generator = rng.pick(freshPool.length ? freshPool : pool);

  return {
    generatorId: generator.id,
    generatorVersion: generator.version,
    params: null, // null ⇒ defaultParams(ctx) at render time; adaptive layer will override
    seed: freshSeed(),
  };
}
