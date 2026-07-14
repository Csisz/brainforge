import type { WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, path, rect, text } from "../svg";

/**
 * DUAL FIND ("Itt-Ott" style) — left hand hunts shapes, right hand hunts
 * numbers, at the same time.
 *
 * Layout mirrors the classic book page: a shape grid on the left, a number
 * grid on the right, and a middle prompt column of (shape, number) pairs
 * flanked by little hand icons. For each pair the child circles one
 * matching shape with the left hand and one matching number with the right
 * hand simultaneously, then moves to the next pair. Trains bilateral
 * coordination, visual scanning and divided attention.
 *
 * Generation guarantee: every prompted shape/number occurs in its grid at
 * least as many times as it is prompted.
 */

export type DualFindParams = {
  gridCols: number;
  gridRows: number;
  pairs: number;
};

type Shape = (cx: number, cy: number, r: number) => string;
const L = { fill: "#1b3a6b", stroke: "none" };
const SHAPES: Shape[] = [
  (x, y, r) => path(`M ${x} ${y - r} L ${x + r} ${y + r * 0.8} L ${x - r} ${y + r * 0.8} Z`, L),
  (x, y, r) => rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, L),
  (x, y, r) => path(starD(x, y, r), L),
  (x, y, r) => path(heartD(x, y, r), L),
  (x, y, r) => circle(x, y, r * 0.8, L),
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
function heartD(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy + r} C ${cx - r * 1.4} ${cy - r * 0.1}, ${cx - r * 0.7} ${cy - r * 1.1}, ${cx} ${cy - r * 0.35} C ${cx + r * 0.7} ${cy - r * 1.1}, ${cx + r * 1.4} ${cy - r * 0.1}, ${cx} ${cy + r} Z`;
}

/** Tiny stylized hand (mitten) icon; side: -1 left, 1 right. */
function handIcon(cx: number, cy: number, side: -1 | 1): string {
  const s = side;
  return group({ opacity: 0.55 }, [
    path(`M ${cx - 2.2 * s} ${cy + 2.4} Q ${cx - 2.6 * s} ${cy - 1.8} ${cx - 0.8 * s} ${cy - 2.2} Q ${cx + 1.6 * s} ${cy - 2.6} ${cx + 2.2 * s} ${cy - 0.6} Q ${cx + 2.5 * s} ${cy + 1.6} ${cx + 0.6 * s} ${cy + 2.6} Z`, {
      fill: "none", stroke: side === -1 ? "#c05050" : "#1b3a6b", "stroke-width": 0.45,
    }),
    path(`M ${cx - 0.8 * s} ${cy - 2.2} L ${cx - 0.4 * s} ${cy - 3.4}`, {
      fill: "none", stroke: side === -1 ? "#c05050" : "#1b3a6b", "stroke-width": 0.45, "stroke-linecap": "round",
    }),
  ].join(""));
}

export const dualFindGenerator: WorksheetGenerator<DualFindParams> = {
  id: "dual_find",
  version: 1,
  goals: ["bilateral_coordination", "attention", "visual_perception", "executive_function"],
  ageRange: [5, 10],

  defaultParams(ctx): DualFindParams {
    const rows = 5 + Math.floor(ctx.difficulty / 2); // 5..7
    return { gridCols: 4, gridRows: rows, pairs: Math.min(6, 3 + Math.floor(ctx.difficulty / 2) + (ctx.age >= 7 ? 1 : 0)) };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160, H = 190;
    const midW = 34;
    const gridW = (W - midW - 8) / 2;
    const cellW = gridW / params.gridCols;
    const cellH = H / params.gridRows;
    const numerals = [1, 2, 3, 4];

    // Prompts: distinct (shape, number) pairs.
    const shapeIdx = ctx.rng.shuffle(SHAPES.map((_, i) => i));
    const prompts = Array.from({ length: params.pairs }, (_, i) => ({
      shape: shapeIdx[i % shapeIdx.length]!,
      num: ctx.rng.pick(numerals),
    }));

    // Fill grids randomly, then guarantee each prompt occurs by stamping it
    // into a reserved random cell.
    const total = params.gridCols * params.gridRows;
    const shapeCells = Array.from({ length: total }, (_, i) => ctx.rng.fork(`s${i}`).int(0, SHAPES.length - 1));
    const numCells = Array.from({ length: total }, (_, i) => numerals[ctx.rng.fork(`n${i}`).int(0, numerals.length - 1)]!);
    const reservedS = ctx.rng.shuffle(Array.from({ length: total }, (_, i) => i)).slice(0, params.pairs);
    const reservedN = ctx.rng.shuffle(Array.from({ length: total }, (_, i) => i)).slice(0, params.pairs);
    prompts.forEach((p, i) => {
      shapeCells[reservedS[i]!] = p.shape;
      numCells[reservedN[i]!] = p.num;
    });

    const parts: string[] = [];
    const r = Math.min(cellW, cellH) * 0.28;

    // Left grid: shapes.
    for (let i = 0; i < total; i++) {
      const cx = (i % params.gridCols) * cellW + cellW / 2;
      const cy = Math.floor(i / params.gridCols) * cellH + cellH / 2;
      parts.push(SHAPES[shapeCells[i]!]!(cx, cy, r));
    }
    // Right grid: numbers.
    const rx0 = gridW + midW + 8;
    for (let i = 0; i < total; i++) {
      const cx = rx0 + (i % params.gridCols) * cellW + cellW / 2;
      const cy = Math.floor(i / params.gridCols) * cellH + cellH / 2 + r * 0.6;
      parts.push(text(cx, cy, String(numCells[i]!), { "font-size": r * 2.1, "font-weight": 700, "text-anchor": "middle", fill: "#8c2f2f" }));
    }

    // Middle prompt column with dividers.
    const mx = gridW + 4;
    parts.push(path(`M ${mx} 0 L ${mx} ${H} M ${mx + midW} 0 L ${mx + midW} ${H}`, { stroke: "#111", "stroke-width": 0.45, fill: "none" }));
    const promptH = H / params.pairs;
    prompts.forEach((p, i) => {
      const cy = promptH * i + promptH / 2;
      const c1x = mx + midW / 2 - 5.5;
      const c2x = mx + midW / 2 + 5.5;
      parts.push(circle(c1x, cy, 4.6, { fill: "none", stroke: "#111", "stroke-width": 0.7 }));
      parts.push(circle(c2x, cy, 4.6, { fill: "none", stroke: "#111", "stroke-width": 0.7 }));
      parts.push(SHAPES[p.shape]!(c1x, cy, 2.6));
      parts.push(text(c2x, cy + 2.0, String(p.num), { "font-size": 5.6, "font-weight": 700, "text-anchor": "middle", fill: "#8c2f2f" }));
      parts.push(handIcon(mx + 4.5, cy + promptH * 0.28, -1));
      parts.push(handIcon(mx + midW - 4.5, cy + promptH * 0.28, 1));
      if (i > 0) parts.push(path(`M ${mx + 2} ${promptH * i} L ${mx + midW - 2} ${promptH * i}`, { stroke: "#e5e5e0", "stroke-width": 0.3, fill: "none" }));
    });

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.dualfind.instruction",
    };
  },
};
