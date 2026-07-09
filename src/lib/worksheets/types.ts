import type { RNG } from "@/lib/random";

/**
 * WORKSHEET ENGINE — CORE CONTRACT
 * --------------------------------
 * Every worksheet type (maze, tracing, symmetry, …) is a plugin implementing
 * WorksheetGenerator. The platform knows nothing about mazes or tracing —
 * it only knows the contract. Adding a new worksheet type = adding one file
 * under generators/ and registering it. No platform code changes.
 *
 * A rendered worksheet is fully determined by:
 *   (generator.id, generator.version, params, seed)
 * That tuple is what we persist. SVG is derived, never stored.
 */

/** Ages supported by the product (PRD §1). */
export type Age = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Development goals (PRD §3). Kept as a closed union so the adaptive layer can reason about them. */
export type DevelopmentGoal =
  | "attention"
  | "working_memory"
  | "executive_function"
  | "visual_perception"
  | "bilateral_coordination"
  | "fine_motor"
  | "pre_writing"
  | "pre_reading"
  | "math_thinking"
  | "creativity"
  | "problem_solving";

/** 1 (easiest) … 5 (hardest). The adaptive layer moves this gradually. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type ThemeId =
  | "dinosaurs" | "princesses" | "space" | "ocean" | "farm"
  | "cars" | "robots" | "unicorns" | "nature" | "magic"
  | "blocks" | "custom";

export type PaperSize = "a4" | "letter";

/** Visual/accessibility rendering options (PRD §9). */
export type RenderOptions = {
  paper: PaperSize;
  /** Locale for on-sheet instructions (hu, en, de, …) */
  locale: string;
  lowInk: boolean;
  highContrast: boolean;
  /** Larger strokes/targets, reduced visual noise. */
  motorSupport: boolean;
};

export type GeneratorContext = {
  rng: RNG;
  age: Age;
  difficulty: Difficulty;
  theme: ThemeId;
  render: RenderOptions;
};

/** What a generator produces: pure geometry + metadata, no page chrome. */
export type WorksheetContent = {
  /** Inner SVG markup (no <svg> wrapper — the page composer adds it). */
  body: string;
  /** Content area the body was drawn for, in mm. */
  width: number;
  height: number;
  /** i18n key for the child-facing instruction line. */
  instructionKey: string;
  /** Values interpolated into the instruction (counts, letters, …). */
  instructionValues?: Record<string, string | number>;
  /** Optional answer key body, rendered on a separate page for parents. */
  answerKey?: string;
};

export type WorksheetGenerator<P = unknown> = {
  id: string;
  /**
   * Bumped on any change that alters output for an existing (params, seed).
   * Old worksheets keep rendering with their stored version — reproducibility
   * survives generator improvements.
   */
  version: number;
  /** Goals this worksheet type trains — used by the activity engine. */
  goals: DevelopmentGoal[];
  /** Inclusive supported age range. */
  ageRange: [Age, Age];
  /** Derive sensible params from context (age/difficulty aware). */
  defaultParams(ctx: GeneratorContext): P;
  /** Pure function: same ctx.rng seed + params ⇒ identical output. */
  generate(ctx: GeneratorContext, params: P): WorksheetContent;
};

/** The persisted identity of a worksheet — this is what goes in the DB. */
export type WorksheetRecipe = {
  generatorId: string;
  generatorVersion: number;
  params: unknown;
  seed: string;
};
