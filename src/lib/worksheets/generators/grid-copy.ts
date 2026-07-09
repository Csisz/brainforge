import type { GeneratorContext, WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, path, rect, text } from "../svg";

/**
 * GRID COPY — reproduce the reference symbol grid into the empty grid.
 *
 * Trains visual scanning, working memory and attention (the child must
 * hold "cell (2,3) = smiley" in mind while switching gaze). Reference grid
 * on top, empty target grid below — the same spatial layout as classroom
 * "copy the board" practice. Difficulty scales grid size and the symbol
 * alphabet (numbers join at d≥3, two-digit numbers at d≥4).
 *
 * Variant hook (params.memoryMode): print the two grids on separate pages
 * so the parent can hide the reference — turns the same recipe into a pure
 * working-memory exercise. Deferred to the session UI sprint.
 */

export type GridCopyParams = {
  cols: number;
  rows: number;
  /** Fraction of cells that carry a symbol. */
  fill: number;
  useNumbers: boolean;
  useTwoDigit: boolean;
};

type Glyph = (cx: number, cy: number, r: number) => string;
const LINE = { fill: "none", stroke: "#111", "stroke-width": 1.0, "stroke-linejoin": "round" as const, "stroke-linecap": "round" as const };

const SYMBOLS: Glyph[] = [
  (cx, cy, r) => circle(cx, cy, r * 0.7, LINE),
  (cx, cy, r) => path(`M ${cx - r * 0.7} ${cy - r * 0.7} L ${cx + r * 0.7} ${cy + r * 0.7} M ${cx + r * 0.7} ${cy - r * 0.7} L ${cx - r * 0.7} ${cy + r * 0.7}`, LINE), // ×
  (cx, cy, r) => path(`M ${cx} ${cy - r * 0.8} L ${cx + r * 0.75} ${cy + r * 0.6} L ${cx - r * 0.75} ${cy + r * 0.6} Z`, LINE),
  (cx, cy, r) => path(`M ${cx} ${cy + r * 0.55} L ${cx} ${cy - r * 0.8} M ${cx - r * 0.45} ${cy - r * 0.35} L ${cx} ${cy - r * 0.8} L ${cx + r * 0.45} ${cy - r * 0.35}`, LINE), // ↑
  (cx, cy, r) => `${circle(cx, cy, r * 0.75, LINE)}${circle(cx - r * 0.28, cy - r * 0.18, 0.7, { fill: "#111" })}${circle(cx + r * 0.28, cy - r * 0.18, 0.7, { fill: "#111" })}${path(`M ${cx - r * 0.35} ${cy + r * 0.2} Q ${cx} ${cy + r * 0.55} ${cx + r * 0.35} ${cy + r * 0.2}`, LINE)}`, // smiley
  (cx, cy, r) => path(`M ${cx - r * 0.8} ${cy + r * 0.3} L ${cx - r * 0.3} ${cy - r * 0.4} L ${cx + r * 0.1} ${cy + r * 0.3} L ${cx + r * 0.8} ${cy - r * 0.4}`, LINE), // zigzag
  (cx, cy, r) => `${circle(cx - r * 0.4, cy, 1, { fill: "#111" })}${circle(cx, cy, 1, { fill: "#111" })}${circle(cx + r * 0.4, cy, 1, { fill: "#111" })}`, // dots
  (cx, cy, r) => path(`M ${cx - r * 0.35} ${cy - r * 0.8} L ${cx - r * 0.35} ${cy + r * 0.8} M ${cx + r * 0.35} ${cy - r * 0.8} L ${cx + r * 0.35} ${cy + r * 0.8} M ${cx - r * 0.8} ${cy - r * 0.3} L ${cx + r * 0.8} ${cy - r * 0.3} M ${cx - r * 0.8} ${cy + r * 0.3} L ${cx + r * 0.8} ${cy + r * 0.3}`, LINE), // #
];

export const gridCopyGenerator: WorksheetGenerator<GridCopyParams> = {
  id: "grid_copy",
  version: 1,
  goals: ["visual_perception", "working_memory", "attention", "fine_motor"],
  ageRange: [4, 10],

  defaultParams(ctx): GridCopyParams {
    const size = 2 + Math.min(3, Math.ceil((ctx.age - 2) / 2)) + (ctx.difficulty >= 4 ? 1 : 0); // 3..6
    return {
      cols: Math.min(6, size),
      rows: Math.min(5, Math.max(3, size - 1)),
      fill: 0.45 + ctx.difficulty * 0.08,
      useNumbers: ctx.difficulty >= 3 && ctx.age >= 5,
      useTwoDigit: ctx.difficulty >= 4 && ctx.age >= 6,
    };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160;
    const gridW = 120;
    const cell = gridW / params.cols;
    const gridH = cell * params.rows;
    const gap = 14;
    const H = gridH * 2 + gap;
    const gx = (W - gridW) / 2;

    const drawGrid = (gy: number, bold: boolean) => {
      const out: string[] = [];
      out.push(rect(gx, gy, gridW, gridH, { fill: "none", stroke: "#111", "stroke-width": bold ? 0.9 : 0.6 }));
      for (let c = 1; c < params.cols; c++) out.push(path(`M ${gx + c * cell} ${gy} L ${gx + c * cell} ${gy + gridH}`, { stroke: "#111", "stroke-width": 0.35, fill: "none" }));
      for (let r = 1; r < params.rows; r++) out.push(path(`M ${gx} ${gy + r * cell} L ${gx + gridW} ${gy + r * cell}`, { stroke: "#111", "stroke-width": 0.35, fill: "none" }));
      return out.join("");
    };

    // Choose filled cells + their symbols.
    const total = params.cols * params.rows;
    const fillCount = Math.max(3, Math.round(total * Math.min(0.75, params.fill)));
    const cells = ctx.rng.shuffle(Array.from({ length: total }, (_, i) => i)).slice(0, fillCount);

    const marks: string[] = [];
    for (const i of cells) {
      const c = i % params.cols, r = Math.floor(i / params.cols);
      const cx = gx + c * cell + cell / 2;
      const cy = r * cell + cell / 2; // relative to grid top
      const rad = cell * 0.32;
      const rng = ctx.rng.fork(`cell-${i}`);
      if (params.useNumbers && rng.chance(0.35)) {
        const n = params.useTwoDigit && rng.chance(0.5) ? rng.int(10, 99) : rng.int(1, 9);
        marks.push(text(cx, cy + rad * 0.55, String(n), {
          "font-size": rad * 1.7, "font-weight": 600, "text-anchor": "middle", fill: "#111",
        }));
      } else {
        marks.push(rng.pick(SYMBOLS)(cx, cy, rad));
      }
    }

    // Reference grid at y=0, target grid below. Cell marks are drawn in
    // grid-relative coordinates so the answer key can reuse them translated.
    const refCells = group({}, marks.join(""));
    const targetY = gridH + gap;
    const answerCells = group({ transform: `translate(0 ${targetY})` }, marks.join("").replace(/#111/g, "#d33"));

    return {
      body: group({}, drawGrid(0, true) + refCells + drawGrid(targetY, false)),
      width: W,
      height: H,
      instructionKey: "worksheet.gridcopy.instruction",
      answerKey: group({}, drawGrid(0, true) + refCells + drawGrid(targetY, false) + group({ opacity: 0.85 }, answerCells)),
    };
  },
};
