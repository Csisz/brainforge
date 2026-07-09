import type { GeneratorContext, WorksheetGenerator, WorksheetContent } from "../types";
import { group, rect, path, circle, el } from "../svg";

/**
 * PATTERN COMPLETION — "what comes next?" rows.
 *
 * Trains sequencing, working memory and early math thinking. Each row shows
 * a repeating pattern with one empty cell; the child draws the missing shape.
 * Pattern grammars scale with difficulty:
 *   d1: AB          d2: AAB / ABB      d3: ABC
 *   d4: AABB / ABCB d5: growing patterns (A AB AAB …) — hardest
 * Shapes are simple line-art glyphs that print in low ink and can be drawn
 * by a child (a critical constraint: the answer must be reproducible with a
 * pencil, so no filled or fine-detail glyphs).
 */

export type PatternParams = {
  rows: number;
  grammars: Grammar[];
  cellSize: number;
};

type Grammar = "AB" | "AAB" | "ABB" | "ABC" | "AABB" | "ABCB" | "GROW";

const GRAMMAR_BY_LEVEL: Record<1 | 2 | 3 | 4 | 5, Grammar[]> = {
  1: ["AB"],
  2: ["AB", "AAB", "ABB"],
  3: ["AAB", "ABB", "ABC"],
  4: ["ABC", "AABB", "ABCB"],
  5: ["AABB", "ABCB", "GROW"],
};

/** Child-drawable line-art glyphs, keyed by slot letter. */
type Glyph = (cx: number, cy: number, r: number) => string;
const GLYPHS: Glyph[] = [
  (cx, cy, r) => circle(cx, cy, r, LINE),
  (cx, cy, r) => rect(cx - r, cy - r, r * 2, r * 2, { ...LINE, rx: r * 0.15 }),
  (cx, cy, r) => path(`M ${cx} ${cy - r} L ${cx + r} ${cy + r} L ${cx - r} ${cy + r} Z`, LINE), // triangle
  (cx, cy, r) => path(`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`, LINE), // diamond
  (cx, cy, r) => path(`M ${cx - r} ${cy} L ${cx + r} ${cy} M ${cx} ${cy - r} L ${cx} ${cy + r}`, LINE), // plus
  (cx, cy, r) => path(heartD(cx, cy, r), LINE),
];
const LINE = { fill: "none", stroke: "#111", "stroke-width": 1.1, "stroke-linejoin": "round" as const, "stroke-linecap": "round" as const };

function heartD(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy + r} C ${cx - r * 1.4} ${cy - r * 0.1}, ${cx - r * 0.7} ${cy - r * 1.1}, ${cx} ${cy - r * 0.35} C ${cx + r * 0.7} ${cy - r * 1.1}, ${cx + r * 1.4} ${cy - r * 0.1}, ${cx} ${cy + r} Z`;
}

function expandGrammar(g: Grammar, len: number): string {
  if (g === "GROW") {
    let s = "";
    let k = 1;
    while (s.length < len) {
      s += "A".repeat(k) + "B";
      k++;
    }
    return s.slice(0, len);
  }
  let s = "";
  while (s.length < len) s += g;
  return s.slice(0, len);
}

export const patternGenerator: WorksheetGenerator<PatternParams> = {
  id: "pattern_completion",
  version: 1,
  goals: ["math_thinking", "working_memory", "attention", "problem_solving"],
  ageRange: [3, 9],

  defaultParams(ctx): PatternParams {
    return {
      rows: ctx.age <= 4 ? 4 : 5,
      grammars: GRAMMAR_BY_LEVEL[ctx.difficulty],
      cellSize: ctx.age <= 4 ? 22 : 18,
    };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160;
    const rowH = params.cellSize + 14;
    const H = params.rows * rowH;
    const parts: string[] = [];
    const answers: string[] = [];

    for (let i = 0; i < params.rows; i++) {
      const rng = ctx.rng.fork(`row-${i}`);
      const grammar = rng.pick(params.grammars);
      const cols = Math.floor((W - 8) / (params.cellSize + 4));
      const seq = expandGrammar(grammar, cols);

      // Assign distinct glyphs to the letters used in this row.
      const letters = [...new Set(seq)];
      const glyphs = rng.shuffle(GLYPHS).slice(0, letters.length);
      const glyphFor = new Map(letters.map((l, j) => [l, glyphs[j]!]));

      // Blank cell: never the first two (child needs to see the pattern start).
      const blank = rng.int(Math.max(2, cols - 4), cols - 1);
      const cy = rowH * i + rowH / 2;

      for (let c = 0; c < cols; c++) {
        const cx = 8 + c * (params.cellSize + 4) + params.cellSize / 2;
        const r = params.cellSize * 0.32;
        const cellBox = rect(cx - params.cellSize / 2, cy - params.cellSize / 2, params.cellSize, params.cellSize, {
          fill: "none",
          stroke: c === blank ? "#111" : "#ccc",
          "stroke-width": c === blank ? 0.9 : 0.4,
          "stroke-dasharray": c === blank ? "2 1.5" : undefined,
          rx: 2,
        });
        parts.push(cellBox);
        const glyphSvg = glyphFor.get(seq[c]!)!(cx, cy, r);
        if (c !== blank) {
          parts.push(glyphSvg);
        } else {
          answers.push(cellBox, group({ opacity: 0.9, stroke: "#d33" }, glyphSvg));
        }
      }
    }

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.pattern.instruction",
      answerKey: group({}, parts.join("") + answers.join("")),
    };
  },
};

// keep `el` referenced for future themed glyph injection without lint noise
void el;
