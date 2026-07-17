/**
 * Engine proof: generate real worksheets from the engine.
 * Run: npm run demo:worksheets
 *
 * demo-output/ is a GOLDEN FILE SET, so everything here is pinned: a fixed
 * seed per case and a fixed render date (the sheet header prints today's date,
 * which would otherwise churn every sheet daily). Output therefore changes only
 * when the engine changes — which makes an unexpected demo-output diff the
 * regression signal, not noise to be re-committed.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { composeWorksheet, defaultRenderOptions } from "../src/lib/worksheets/page";
import { composeSession } from "../src/lib/activities/engine";

/** Pinned so the golden sheets do not change when the calendar does. */
const DEMO_DATE = new Date("2026-01-01T00:00:00Z");

mkdirSync("demo-output", { recursive: true });

const cases = [
  { gen: "maze", age: 5 as const, difficulty: 3 as const, locale: "hu", name: "Lili" },
  { gen: "tracing", age: 3 as const, difficulty: 2 as const, locale: "hu", name: "Bence" },
  { gen: "pattern_completion", age: 6 as const, difficulty: 4 as const, locale: "hu", name: "Zoé" },
  { gen: "mirror_drawing", age: 6 as const, difficulty: 3 as const, locale: "hu", name: "Lili" },
  { gen: "grid_copy", age: 7 as const, difficulty: 4 as const, locale: "hu", name: "Zoé" },
  { gen: "arrow_board", age: 6 as const, difficulty: 4 as const, locale: "hu", name: "Bence" },
  { gen: "connect_the_dots", age: 6 as const, difficulty: 3 as const, locale: "hu", name: "Lili" },
  { gen: "counting", age: 4 as const, difficulty: 2 as const, locale: "hu", name: "Bence" },
  { gen: "matching", age: 4 as const, difficulty: 3 as const, locale: "hu", name: "Zoé" },
  { gen: "symmetry_grid", age: 5 as const, difficulty: 3 as const, locale: "hu", name: "Lili" },
  { gen: "visual_search", age: 6 as const, difficulty: 3 as const, locale: "hu", name: "Zoé" },
  { gen: "dual_path", age: 6 as const, difficulty: 3 as const, locale: "hu", name: "Lili" },
  { gen: "dual_find", age: 7 as const, difficulty: 4 as const, locale: "hu", name: "Bence" },
  { gen: "memory_cards", age: 5 as const, difficulty: 3 as const, locale: "hu", name: "Zoé" },
  { gen: "logic_grid", age: 8 as const, difficulty: 4 as const, locale: "hu", name: "Bence" },
  { gen: "color_by_rule", age: 5 as const, difficulty: 3 as const, locale: "hu", name: "Lili" },
  { gen: "sequencing", age: 6 as const, difficulty: 3 as const, locale: "hu", name: "Zoé" },
  { gen: "cut_and_paste", age: 5 as const, difficulty: 3 as const, locale: "hu", name: "Lili" },
  { gen: "hidden_objects", age: 7 as const, difficulty: 4 as const, locale: "hu", name: "Bence" },
  { gen: "reward_chart", age: 6 as const, difficulty: 3 as const, locale: "hu", name: "Zita" },
];

for (const c of cases) {
  const recipe = { generatorId: c.gen, generatorVersion: 1, params: null, seed: `demo-${c.gen}` };
  const page = composeWorksheet(
    recipe,
    { age: c.age, difficulty: c.difficulty, theme: "space", render: defaultRenderOptions(c.locale) },
    { childName: c.name, date: DEMO_DATE },
  );
  writeFileSync(`demo-output/${c.gen}.svg`, page.svg);
  if (page.answerKeySvg) writeFileSync(`demo-output/${c.gen}-answer.svg`, page.answerKeySvg);
  console.log(`${c.gen}: seed=${recipe.seed}`);
}

// Determinism check: same seed must yield byte-identical SVG. With the date
// pinned this compares whole bytes — it used to strip the date with a regex,
// which quietly exempted the header from the check.
const fixed = { generatorId: "maze", generatorVersion: 1, params: null, seed: "test-seed-123" };
const ctx = { age: 5 as const, difficulty: 3 as const, theme: "space" as const, render: defaultRenderOptions("en") };
const a = composeWorksheet(fixed, ctx, { date: DEMO_DATE }).svg;
const b = composeWorksheet(fixed, ctx, { date: DEMO_DATE }).svg;
console.log("determinism:", a === b ? "PASS" : "FAIL");

// Session composer smoke test
const plan = composeSession({
  childId: "demo", age: 5, goals: ["fine_motor", "attention"], theme: "space",
  durationMin: 30, materials: ["pencil", "paper", "cups", "ball"], difficulty: 3,
  recentWorksheets: [], locale: "hu",
});
console.log("session plan:", plan.slots.map((s) => s.kind).join(" → "), `(${plan.totalMinutes} min)`);

// Pictogram strips
import("../src/lib/pictograms").then(({ composePictogram, pictogramKeys }) => {
  for (const key of pictogramKeys()) {
    const svg = composePictogram(key);
    if (svg) writeFileSync(`demo-output/picto-${key.replace(/\./g, "_")}.svg`, svg);
  }
  console.log("pictograms:", pictogramKeys().join(", "));
});
