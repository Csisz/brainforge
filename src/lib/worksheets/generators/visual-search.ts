import type { WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, path, rect, text } from "../svg";
import { themeSearchGlyphs } from "../theme-glyphs";

/**
 * VISUAL SEARCH — find and circle every target glyph in the field.
 *
 * Classic attention/scanning drill (the printable cousin of "hidden
 * objects"). A header strip shows the target and how many to find; the
 * field is a jittered grid of distractor glyphs with the target planted
 * k times. Difficulty raises density and, from d3, swaps in near-miss
 * distractors (rotated/mirrored variants of the target family).
 * Answer key circles the targets.
 */

export type SearchParams = {
  cols: number;
  rows: number;
  targets: number;
};

type Glyph = (cx: number, cy: number, r: number) => string;
const L = { fill: "none", stroke: "#111", "stroke-width": 0.9, "stroke-linejoin": "round" as const, "stroke-linecap": "round" as const };

/** Families: [target, near-miss distractors...] */
const FAMILIES: Glyph[][] = [
  [ // triangle up vs down/left
    (x, y, r) => path(`M ${x} ${y - r} L ${x + r} ${y + r * 0.8} L ${x - r} ${y + r * 0.8} Z`, L),
    (x, y, r) => path(`M ${x} ${y + r} L ${x + r} ${y - r * 0.8} L ${x - r} ${y - r * 0.8} Z`, L),
    (x, y, r) => path(`M ${x - r} ${y} L ${x + r * 0.8} ${y - r} L ${x + r * 0.8} ${y + r} Z`, L),
  ],
  [ // b-like vs d-like (circle with stem left/right)
    (x, y, r) => `${circle(x + r * 0.25, y + r * 0.25, r * 0.6, L)}${path(`M ${x - r * 0.35} ${y - r} L ${x - r * 0.35} ${y + r * 0.85}`, L)}`,
    (x, y, r) => `${circle(x - r * 0.25, y + r * 0.25, r * 0.6, L)}${path(`M ${x + r * 0.35} ${y - r} L ${x + r * 0.35} ${y + r * 0.85}`, L)}`,
  ],
  [ // star vs plus/x
    (x, y, r) => path(starD(x, y, r), L),
    (x, y, r) => path(`M ${x - r} ${y} L ${x + r} ${y} M ${x} ${y - r} L ${x} ${y + r}`, L),
    (x, y, r) => path(`M ${x - r * 0.8} ${y - r * 0.8} L ${x + r * 0.8} ${y + r * 0.8} M ${x + r * 0.8} ${y - r * 0.8} L ${x - r * 0.8} ${y + r * 0.8}`, L),
  ],
];

function starD(cx: number, cy: number, r: number): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${p.join(" L ")} Z`;
}

export const visualSearchGenerator: WorksheetGenerator<SearchParams> = {
  id: "visual_search",
  version: 2, // v2: themed target/distractors for nature/space/ocean (Sprint 7 M5b)
  goals: ["attention", "visual_perception", "pre_reading"],
  ageRange: [3, 10],

  defaultParams(ctx): SearchParams {
    const cols = 5 + ctx.difficulty;           // 6..10
    const rows = 6 + ctx.difficulty;           // 7..11
    return { cols, rows, targets: Math.min(12, 4 + ctx.difficulty + Math.floor(ctx.age / 3)) };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160, H = 185;
    const headerH = 18;
    // Themed themes hunt distinct themed objects (every fish among shells and
    // drops); other themes keep the confusable near-miss geometric families, so
    // the harder d3+ discrimination drill is preserved where there is no theme art.
    const themed = themeSearchGlyphs(ctx.theme);
    let target: Glyph;
    let distractors: Glyph[];
    if (themed) {
      target = (x, y, r) => themed[0]!(x, y, r, L);
      distractors = themed.slice(1).map((g) => (x: number, y: number, r: number) => g(x, y, r, L));
    } else {
      const family = ctx.rng.pick(FAMILIES);
      target = family[0]!;
      distractors = ctx.difficulty >= 3 && family.length > 1 ? family.slice(1) : [family[family.length - 1]!];
    }

    const fieldY = headerH + 4;
    const cellW = W / params.cols;
    const cellH = (H - fieldY) / params.rows;
    const r = Math.min(cellW, cellH) * 0.3;

    const total = params.cols * params.rows;
    const targetCells = new Set(ctx.rng.shuffle(Array.from({ length: total }, (_, i) => i)).slice(0, params.targets));

    const parts: string[] = [];
    const answers: string[] = [];

    // Header: target sample + underline.
    parts.push(rect(1, 1, 30, headerH - 2, { fill: "none", stroke: "#111", "stroke-width": 0.6, rx: 2.5 }));
    parts.push(target(16, headerH / 2, r * 1.15));
    parts.push(text(38, headerH / 2 + 2.2, `× ${params.targets}`, { "font-size": 6.5, "font-weight": 700, fill: "#111" }));
    parts.push(path(`M 1 ${headerH + 1.5} L ${W - 1} ${headerH + 1.5}`, { stroke: "#e5e5e0", "stroke-width": 0.3, fill: "none" }));

    for (let i = 0; i < total; i++) {
      const rng = ctx.rng.fork(`cell-${i}`);
      const cx = (i % params.cols) * cellW + cellW / 2 + rng.int(-Math.floor(cellW * 0.12), Math.floor(cellW * 0.12));
      const cy = fieldY + Math.floor(i / params.cols) * cellH + cellH / 2 + rng.int(-Math.floor(cellH * 0.12), Math.floor(cellH * 0.12));
      if (targetCells.has(i)) {
        parts.push(target(cx, cy, r));
        answers.push(circle(cx, cy, r * 1.7, { fill: "none", stroke: "#d33", "stroke-width": 0.8 }));
      } else {
        parts.push(rng.pick(distractors)(cx, cy, r));
      }
    }

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.search.instruction",
      answerKey: group({}, parts.join("") + answers.join("")),
    };
  },
};
