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
  /**
   * Session-wide fallback. Used for any goal `adaptive` does not cover, and for
   * every goal when the parent overrode the slider or turned adaptive off.
   */
  difficulty: Difficulty;
  /** (generatorId, paramsHash) pairs used recently — never repeat (PRD §6). */
  recentWorksheets: Array<{ generatorId: string; seed: string }>;
  /**
   * Physical activity keys from the child's last couple of sessions (Sprint 8
   * M1b). The composer deprioritizes them per category, mirroring worksheet
   * anti-repetition, so a family that plays every day does not get "Simon says"
   * five mornings running — with the same graceful fallback as materials when
   * avoiding them would leave a category empty.
   */
  recentActivities?: string[];
  locale: string;
  /**
   * Adaptive calibration (Sprint 5). Absent ⇒ every worksheet uses
   * `difficulty`. The server loads it and passes it in; this module stays pure
   * and knows nothing about the DB or the calibration rules.
   */
  adaptive?: AdaptivePlan;
};

/** What calibration tells the composer, resolved per goal by the server. */
export type AdaptivePlan = {
  /** Calibrated level per goal. A goal absent here falls back to `difficulty`. */
  levelByGoal: Partial<Record<DevelopmentGoal, Difficulty>>;
  /** rotate_variety: generator ids to avoid for a goal (success without joy). */
  avoidByGoal?: Partial<Record<DevelopmentGoal, string[]>>;
  /**
   * pending_anchor: this goal's next session owes the child a guaranteed win,
   * so one worksheet must come from the named generator.
   */
  anchor?: { goal: DevelopmentGoal; generatorId: string };
};

export type MaterialId =
  | "pencil" | "crayons" | "scissors" | "glue" | "paper"
  | "ball" | "cups" | "blocks" | "tape" | "dice";

export type SessionSlot =
  | { kind: "warmup"; activityKey: string; minutes: number }
  | { kind: "movement"; activityKey: string; minutes: number }
  | { kind: "worksheet"; recipe: WorksheetRecipe; minutes: number; goal: DevelopmentGoal; difficulty: Difficulty }
  | { kind: "memory_game"; activityKey: string; minutes: number }
  | { kind: "creative"; activityKey: string; minutes: number }
  | { kind: "reward"; activityKey: string; minutes: number }
  | { kind: "reflection"; activityKey: string; minutes: number };

export type WorksheetSlot = Extract<SessionSlot, { kind: "worksheet" }>;

/**
 * A slot read back from `sessions.plan`, where `goal`/`difficulty` may be
 * missing — but ONLY because the row predates Sprint 5. The composer types them
 * as required, so a freshly composed slot always has them: a worksheet slot
 * without a goal can mean "legacy row", never "new bug silently skipping
 * calibration". Read stored plans as this; compose as SessionSlot.
 */
export type StoredSessionSlot =
  | Exclude<SessionSlot, { kind: "worksheet" }>
  | (Omit<WorksheetSlot, "goal" | "difficulty"> & { goal?: DevelopmentGoal; difficulty?: Difficulty });

export type SessionPlan = {
  slots: SessionSlot[];
  totalMinutes: number;
};

/**
 * A plan read back from `sessions.plan`. Always read stored plans as this, never
 * as SessionPlan: casting jsonb to SessionPlan tells the compiler every
 * worksheet slot has a goal, which is untrue for pre-Sprint-5 rows and hides
 * exactly the case that must stay visible. A freshly composed SessionPlan is
 * assignable to it.
 */
export type StoredSessionPlan = {
  slots: StoredSessionSlot[];
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
    { key: "activity.warmup.breathing_balloon", materials: [], minAge: 2 },
    { key: "activity.warmup.mirror_me", materials: [], minAge: 2 },
    { key: "activity.warmup.wake_up_stretch", materials: [], minAge: 2 },
    { key: "activity.warmup.name_clap", materials: [], minAge: 3 },
  ],
  movement: [
    { key: "activity.movement.cross_crawl", materials: [], minAge: 4 },
    { key: "activity.movement.ball_target", materials: ["ball"], minAge: 3 },
    { key: "activity.movement.obstacle_course", materials: ["tape"], minAge: 3 },
    { key: "activity.movement.animal_walks", materials: [], minAge: 2 },
    { key: "activity.movement.balloon_keep_up", materials: [], minAge: 3 },
    { key: "activity.movement.hopscotch", materials: ["tape"], minAge: 4 },
    { key: "activity.movement.bean_bag_balance", materials: [], minAge: 3 },
    { key: "activity.movement.freeze_dance", materials: [], minAge: 2 },
  ],
  memory_game: [
    { key: "activity.memory.cup_shuffle", materials: ["cups"], minAge: 3 },
    { key: "activity.memory.whats_missing", materials: [], minAge: 3 },
    { key: "activity.memory.sound_sequence", materials: [], minAge: 4 },
    { key: "activity.memory.what_changed", materials: [], minAge: 4 },
    { key: "activity.memory.story_chain", materials: [], minAge: 5 },
    { key: "activity.memory.touch_and_tell", materials: [], minAge: 4 },
    { key: "activity.memory.copy_the_tower", materials: ["blocks"], minAge: 4 },
  ],
  creative: [
    { key: "activity.creative.build_story", materials: ["blocks"], minAge: 3 },
    { key: "activity.creative.draw_theme", materials: ["crayons", "paper"], minAge: 2 },
    { key: "activity.creative.cut_collage", materials: ["scissors", "glue", "paper"], minAge: 4 },
    { key: "activity.creative.shadow_shapes", materials: [], minAge: 3 },
    { key: "activity.creative.paper_fold", materials: ["paper"], minAge: 4 },
    { key: "activity.creative.object_faces", materials: [], minAge: 3 },
    { key: "activity.creative.junk_build", materials: [], minAge: 3 },
  ],
  reward: [
    { key: "activity.reward.sticker_moment", materials: [], minAge: 2 },
    { key: "activity.reward.victory_dance", materials: [], minAge: 2 },
    { key: "activity.reward.high_five_tower", materials: [], minAge: 2 },
    { key: "activity.reward.proud_moment", materials: [], minAge: 2 },
    { key: "activity.reward.choose_the_song", materials: [], minAge: 2 },
    { key: "activity.reward.cheer_chant", materials: [], minAge: 2 },
    { key: "activity.reward.reward_stamp", materials: [], minAge: 2 },
  ],
  reflection: [
    { key: "activity.reflection.favorite_part", materials: [], minAge: 3 },
    { key: "activity.reflection.show_and_tell", materials: [], minAge: 2 },
    { key: "activity.reflection.thumbs_check", materials: [], minAge: 3 },
    { key: "activity.reflection.one_word", materials: [], minAge: 4 },
    { key: "activity.reflection.hardest_easiest", materials: [], minAge: 4 },
    { key: "activity.reflection.teach_me", materials: [], minAge: 4 },
    { key: "activity.reflection.tomorrow_wish", materials: [], minAge: 4 },
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

  // The anchor is owed to exactly one worksheet, so it is spent on the first
  // one composed and not offered to the rest.
  let anchor = req.adaptive?.anchor;

  const slots: SessionSlot[] = template.map((slot) => {
    if (slot.kind === "worksheet") {
      const sheet = pickWorksheet(req, rng, anchor);
      anchor = undefined;
      return { kind: "worksheet", minutes: slot.minutes, ...sheet };
    }
    const chosen = rng.pick(physicalCandidates(slot.kind, req, usedKeys));
    usedKeys.add(chosen.key);
    return { kind: slot.kind, activityKey: chosen.key, minutes: slot.minutes } as SessionSlot;
  });

  return { slots, totalMinutes: template.reduce((s, t) => s + t.minutes, 0) };
}

type PhysicalKind = Exclude<SessionSlot["kind"], "worksheet">;

/**
 * Candidate activities for a physical slot, best tier first — and NEVER empty.
 *
 * Preference order: everything fits → no materials needed → age fits but the
 * cupboard doesn't → anything of this kind. The last two tiers exist because
 * the ideal ("never suggest what the family doesn't have") has no answer for
 * some real requests: every `creative` activity needs materials, so a 45-minute
 * session with only pencil and paper had no candidate at all, and every
 * `memory_game` is 3+, so a 2-year-old had none either. Both are reachable from
 * the wizard's own defaults, and both used to throw "pick() on empty array"
 * before the parent ever saw a plan. A slightly-off suggestion degrades the
 * session; an exception loses it.
 */
function physicalCandidates(kind: PhysicalKind, req: SessionRequest, usedKeys: Set<string>) {
  const all = PHYSICAL_POOL[kind];
  const fits = (a: (typeof all)[number]) => a.materials.every((m) => req.materials.includes(m));
  const recent = new Set(req.recentActivities ?? []);
  const tiers = [
    // Best: age fits, materials on hand, unused this session, AND not seen in the
    // last couple of sessions. Cross-session freshness is a *preference*, so it
    // degrades exactly like the material tiers below when it would empty the pool.
    all.filter((a) => a.minAge <= req.age && fits(a) && !usedKeys.has(a.key) && !recent.has(a.key)),
    all.filter((a) => a.minAge <= req.age && fits(a) && !usedKeys.has(a.key)),
    all.filter((a) => a.materials.length === 0 && a.minAge <= req.age),
    all.filter((a) => a.minAge <= req.age),
    all,
  ];
  return tiers.find((t) => t.length > 0) ?? all;
}

/** Every physical activity flattened, for lookups by key. */
const ALL_ACTIVITIES = Object.values(PHYSICAL_POOL).flat();

/** The materials a physical activity needs (empty for worksheet slots or unknowns). */
export function activityMaterials(activityKey: string): MaterialId[] {
  return ALL_ACTIVITIES.find((a) => a.key === activityKey)?.materials ?? [];
}

/**
 * The set of physical activities this request could draw from: everything
 * age-appropriate whose materials the family has, across the kinds this
 * duration's template uses (tier 0 of physicalCandidates). Adding a material can
 * only unlock activities, never hide them, so the pool grows monotonically with
 * the materials list — the property the M5c audit test pins for 30/45-min plans.
 */
export function candidatePool(req: Pick<SessionRequest, "age" | "durationMin" | "materials">): Set<string> {
  const pool = new Set<string>();
  for (const slot of TEMPLATES[req.durationMin]) {
    if (slot.kind === "worksheet") continue;
    for (const a of PHYSICAL_POOL[slot.kind]) {
      if (a.minAge <= req.age && a.materials.every((m) => req.materials.includes(m))) pool.add(a.key);
    }
  }
  return pool;
}

/**
 * Pick one worksheet, and record WHICH GOAL it was picked for. That attribution
 * is the whole basis of per-goal calibration: feedback on this slot moves this
 * goal's level and no other's, so a child who aced the fine-motor sheet is not
 * stepped down because the memory game went badly.
 */
function pickWorksheet(
  req: SessionRequest,
  rng: ReturnType<typeof createRng>,
  anchor: AdaptivePlan["anchor"],
): Pick<WorksheetSlot, "recipe" | "goal" | "difficulty"> {
  const goal = anchor?.goal ?? rng.pick(req.goals);
  const difficulty = req.adaptive?.levelByGoal[goal] ?? req.difficulty;

  const generator = anchor
    ? // The anchor is a promise of a win after a hard session: take it as given
      // rather than letting anti-repetition or variety talk us out of it.
      (findGenerators({ age: req.age }).find((g) => g.id === anchor.generatorId) ?? pickFrom(req, rng, goal))
    : pickFrom(req, rng, goal);

  return {
    goal,
    difficulty,
    recipe: {
      generatorId: generator.id,
      generatorVersion: generator.version,
      // null ⇒ defaultParams(ctx) at render time, driven by slot.difficulty.
      params: null,
      seed: freshSeed(),
    },
  };
}

function pickFrom(req: SessionRequest, rng: ReturnType<typeof createRng>, goal: DevelopmentGoal) {
  const candidates = findGenerators({ goal, age: req.age });
  const pool = candidates.length ? candidates : findGenerators({ age: req.age });

  // Anti-repetition (PRD §6): deprioritize generators used recently. When
  // calibration reports boredom, this goal's recent ids are excluded too —
  // succeeding without enjoying it means the material is stale, not too easy.
  const avoid = new Set([
    ...req.recentWorksheets.map((w) => w.generatorId),
    ...(req.adaptive?.avoidByGoal?.[goal] ?? []),
  ]);
  const freshPool = pool.filter((g) => !avoid.has(g.id));
  return rng.pick(freshPool.length ? freshPool : pool);
}
