import type { WorksheetGenerator, WorksheetContent } from "../types";
import { group, path, rect } from "../svg";
import { GLYPHS, outline } from "./glyph-set";

/**
 * LOGIC GRID — a picture Latin-square puzzle.
 *
 * An N×N grid (4×4, or 6×6 from difficulty 4) where every row and every
 * column must contain each symbol exactly once. Some cells are pre-filled;
 * the child works out the rest. Trains logical reasoning, elimination and
 * working memory. The puzzle is built by generating a full solution, then
 * removing cells one at a time only while the solution stays unique (checked
 * by a solution-counting solver), so every sheet is solvable and unambiguous.
 * The answer key fills the solved cells in red.
 */

export type LogicGridParams = {
  n: number;
  /** Upper bound on removed (blank) cells — scales difficulty. */
  removeCap: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const LINE = { fill: "none", stroke: "#111", "stroke-width": 1.0, "stroke-linejoin": "round" as const, "stroke-linecap": "round" as const };

/** Count solutions of a Latin-square grid (-1 = empty), capped at `limit`. */
function countSolutions(grid: number[][], n: number, limit = 2): number {
  // Most-constrained empty cell (MRV) for speed.
  let br = -1, bc = -1, bestCand: number[] | null = null;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (grid[r]![c] !== -1) continue;
      const cand: number[] = [];
      for (let v = 0; v < n; v++) {
        let ok = true;
        for (let k = 0; k < n; k++) if (grid[r]![k] === v || grid[k]![c] === v) { ok = false; break; }
        if (ok) cand.push(v);
      }
      if (cand.length === 0) return 0;
      if (bestCand === null || cand.length < bestCand.length) {
        br = r; bc = c; bestCand = cand;
        if (cand.length === 1) break;
      }
    }
    if (bestCand && bestCand.length === 1) break;
  }
  if (br === -1) return 1; // no empty cell → complete

  let total = 0;
  for (const v of bestCand!) {
    grid[br]![bc] = v;
    total += countSolutions(grid, n, limit - total);
    grid[br]![bc] = -1;
    if (total >= limit) break;
  }
  return total;
}

export const logicGridGenerator: WorksheetGenerator<LogicGridParams> = {
  id: "logic_grid",
  version: 1,
  goals: ["problem_solving", "working_memory", "math_thinking", "attention"],
  ageRange: [5, 10],

  defaultParams(ctx): LogicGridParams {
    const n = ctx.difficulty >= 4 && ctx.age >= 7 ? 6 : 4;
    return { n, removeCap: Math.round(n * n * (0.32 + ctx.difficulty * 0.06)) };
  },

  generate(ctx, params): WorksheetContent {
    const n = params.n;

    // Random Latin square: permute rows, columns and symbols of the base square.
    const rowP = ctx.rng.shuffle(Array.from({ length: n }, (_, i) => i));
    const colP = ctx.rng.shuffle(Array.from({ length: n }, (_, i) => i));
    const symP = ctx.rng.shuffle(Array.from({ length: n }, (_, i) => i));
    const solution: number[][] = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => symP[(rowP[i]! + colP[j]!) % n]!),
    );

    // Remove cells greedily while the solution stays unique.
    const puzzle = solution.map((row) => [...row]);
    const order = ctx.rng.shuffle(Array.from({ length: n * n }, (_, i) => i));
    let removed = 0;
    for (const idx of order) {
      if (removed >= params.removeCap) break;
      const r = Math.floor(idx / n), c = idx % n;
      const saved = puzzle[r]![c]!;
      puzzle[r]![c] = -1;
      if (countSolutions(puzzle.map((row) => [...row]), n) === 1) removed++;
      else puzzle[r]![c] = saved;
    }

    const glyphIdx = ctx.rng.shuffle(GLYPHS.map((_, i) => i)).slice(0, n);
    const drawSym = (v: number, cx: number, cy: number, r: number, color?: string) =>
      GLYPHS[glyphIdx[v]!]!.draw(cx, cy, r, color ? { ...outline(1.1), stroke: color } : outline(1.2));

    const G = 156;
    const cell = G / n;
    const r = cell * 0.3;

    const gridLines: string[] = [rect(0, 0, G, G, { ...LINE, "stroke-width": 1.2 })];
    for (let i = 1; i < n; i++) {
      gridLines.push(path(`M ${i * cell} 0 L ${i * cell} ${G}`, { ...LINE, "stroke-width": 0.5 }));
      gridLines.push(path(`M 0 ${i * cell} L ${G} ${i * cell}`, { ...LINE, "stroke-width": 0.5 }));
    }

    const givens: string[] = [];
    const answers: string[] = [];
    for (let rr = 0; rr < n; rr++) {
      for (let cc = 0; cc < n; cc++) {
        const cx = cc * cell + cell / 2;
        const cy = rr * cell + cell / 2;
        if (puzzle[rr]![cc] !== -1) {
          givens.push(drawSym(puzzle[rr]![cc]!, cx, cy, r));
        } else {
          answers.push(drawSym(solution[rr]![cc]!, cx, cy, r, "#d33"));
        }
      }
    }

    const base = gridLines.join("") + givens.join("");
    return {
      body: group({}, base),
      width: G,
      height: G,
      instructionKey: "worksheet.logicgrid.instruction",
      answerKey: group({}, base + answers.join("")),
    };
  },
};
