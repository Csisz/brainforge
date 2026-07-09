import type { DevelopmentGoal, WorksheetGenerator, Age } from "./types";
import { mazeGenerator } from "./generators/maze";
import { tracingGenerator } from "./generators/tracing";
import { patternGenerator } from "./generators/pattern-completion";
import { mirrorGenerator } from "./generators/mirror-drawing";
import { gridCopyGenerator } from "./generators/grid-copy";
import { arrowBoardGenerator } from "./generators/arrow-board";

/**
 * GENERATOR REGISTRY
 * ------------------
 * The single place a new worksheet type is wired in. The activity engine
 * queries this by goal + age; the render pipeline looks up by id.
 *
 * Roadmap (from PRD §4 — do NOT invent beyond this list):
 * TODO: symmetry, hidden_objects, memory_cards, matching, logic_grid,
 *       color_by_rule, cut_and_paste, counting, sequencing, connect_the_dots
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generators: ReadonlyArray<WorksheetGenerator<any>> = [
  mazeGenerator,
  tracingGenerator,
  patternGenerator,
  mirrorGenerator,
  gridCopyGenerator,
  arrowBoardGenerator,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGenerator(id: string): WorksheetGenerator<any> {
  const g = generators.find((g) => g.id === id);
  if (!g) throw new Error(`Unknown worksheet generator: ${id}`);
  return g;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findGenerators(opts: { goal?: DevelopmentGoal; age?: Age }): ReadonlyArray<WorksheetGenerator<any>> {
  return generators.filter((g) => {
    if (opts.goal && !g.goals.includes(opts.goal)) return false;
    if (opts.age !== undefined && (opts.age < g.ageRange[0] || opts.age > g.ageRange[1])) return false;
    return true;
  });
}

export function allGenerators() {
  return generators;
}
