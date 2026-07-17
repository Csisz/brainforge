import type { DevelopmentGoal, WorksheetGenerator, Age } from "./types";
import { mazeGenerator } from "./generators/maze";
import { tracingGenerator } from "./generators/tracing";
import { patternGenerator } from "./generators/pattern-completion";
import { mirrorGenerator } from "./generators/mirror-drawing";
import { gridCopyGenerator } from "./generators/grid-copy";
import { arrowBoardGenerator } from "./generators/arrow-board";
import { connectDotsGenerator } from "./generators/connect-the-dots";
import { countingGenerator } from "./generators/counting";
import { matchingGenerator } from "./generators/matching";
import { symmetryGridGenerator } from "./generators/symmetry-grid";
import { visualSearchGenerator } from "./generators/visual-search";
import { dualPathGenerator } from "./generators/dual-path";
import { dualFindGenerator } from "./generators/dual-find";
import { memoryCardsGenerator } from "./generators/memory-cards";
import { logicGridGenerator } from "./generators/logic-grid";
import { colorByRuleGenerator } from "./generators/color-by-rule";
import { sequencingGenerator } from "./generators/sequencing";
import { cutAndPasteGenerator } from "./generators/cut-and-paste";
import { hiddenObjectsGenerator } from "./generators/hidden-objects";
import { rewardChartGenerator } from "./generators/reward-chart";

/**
 * GENERATOR REGISTRY
 * ------------------
 * The single place a new worksheet type is wired in. The activity engine
 * queries this by goal + age; the render pipeline looks up by id.
 *
 * All PRD §4 worksheet types are now implemented (19 generators).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const generators: ReadonlyArray<WorksheetGenerator<any>> = [
  mazeGenerator,
  tracingGenerator,
  patternGenerator,
  mirrorGenerator,
  gridCopyGenerator,
  arrowBoardGenerator,
  connectDotsGenerator,
  countingGenerator,
  matchingGenerator,
  symmetryGridGenerator,
  visualSearchGenerator,
  dualPathGenerator,
  dualFindGenerator,
  memoryCardsGenerator,
  logicGridGenerator,
  colorByRuleGenerator,
  sequencingGenerator,
  cutAndPasteGenerator,
  hiddenObjectsGenerator,
  rewardChartGenerator,
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
    // catalogOnly types (reward collection sheets) are never composed into a
    // session — they are the composer's only exclusion, keyed off the contract
    // rather than an id list here.
    if (g.catalogOnly) return false;
    if (opts.goal && !g.goals.includes(opts.goal)) return false;
    if (opts.age !== undefined && (opts.age < g.ageRange[0] || opts.age > g.ageRange[1])) return false;
    return true;
  });
}

export function allGenerators() {
  return generators;
}
