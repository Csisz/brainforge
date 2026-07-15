import type { GeneratorContext, WorksheetGenerator, WorksheetContent } from "../types";
import { line, circle, group, text, path } from "../svg";

/**
 * MAZE — procedural, recursive-backtracker.
 *
 * Pedagogical intent: visual scanning, planning (executive function),
 * fine-motor pencil control. Difficulty scales grid density and corridor
 * width; younger ages get wide corridors and short solutions.
 *
 * Quality invariants enforced here (risk #3 from the architecture review —
 * "valid but boring" mazes):
 *  - solution length ≥ 40% of cell count (backtracker gives long, winding
 *    solutions naturally; we verify and re-carve with a forked RNG if not)
 *  - entrance top-left, exit bottom-right (consistent reading direction)
 */

export type MazeParams = {
  cols: number;
  rows: number;
  /** Corridor stroke width in mm — motor support increases it. */
  wall: number;
};

type Cell = { x: number; y: number };
const DIRS = [
  { dx: 0, dy: -1, wall: 0, opp: 2 }, // N
  { dx: 1, dy: 0, wall: 1, opp: 3 }, // E
  { dx: 0, dy: 1, wall: 2, opp: 0 }, // S
  { dx: -1, dy: 0, wall: 3, opp: 1 }, // W
] as const;

function carve(cols: number, rows: number, rng: GeneratorContext["rng"]): Uint8Array {
  // walls[i] bitmask: 1=N 2=E 4=S 8=W (set = wall present)
  const walls = new Uint8Array(cols * rows).fill(0b1111);
  const visited = new Uint8Array(cols * rows);
  const idx = (c: Cell) => c.y * cols + c.x;
  const stack: Cell[] = [{ x: 0, y: 0 }];
  visited[0] = 1;

  while (stack.length) {
    const cur = stack[stack.length - 1]!;
    const options = DIRS.filter((d) => {
      const nx = cur.x + d.dx, ny = cur.y + d.dy;
      return nx >= 0 && ny >= 0 && nx < cols && ny < rows && !visited[ny * cols + nx];
    });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const d = rng.pick(options);
    const next = { x: cur.x + d.dx, y: cur.y + d.dy };
    walls[idx(cur)]! &= ~(1 << d.wall);
    walls[idx(next)]! &= ~(1 << d.opp);
    visited[idx(next)] = 1;
    stack.push(next);
  }
  return walls;
}

/** BFS solution path from (0,0) to (cols-1, rows-1). */
function solve(walls: Uint8Array, cols: number, rows: number): Cell[] {
  const prev = new Int32Array(cols * rows).fill(-1);
  const start = 0, goal = cols * rows - 1;
  const q = [start];
  const seen = new Uint8Array(cols * rows);
  seen[start] = 1;
  while (q.length) {
    const i = q.shift()!;
    if (i === goal) break;
    const x = i % cols, y = Math.floor(i / cols);
    for (const d of DIRS) {
      if (walls[i]! & (1 << d.wall)) continue;
      const j = (y + d.dy) * cols + (x + d.dx);
      if (seen[j]) continue;
      seen[j] = 1;
      prev[j] = i;
      q.push(j);
    }
  }
  const out: Cell[] = [];
  for (let i = goal; i !== -1; i = prev[i]!) out.push({ x: i % cols, y: Math.floor(i / cols) });
  return out.reverse();
}

export const mazeGenerator: WorksheetGenerator<MazeParams> = {
  id: "maze",
  version: 1,
  goals: ["visual_perception", "executive_function", "fine_motor", "problem_solving"],
  ageRange: [3, 10],

  defaultParams(ctx): MazeParams {
    // Grid density grows with age and difficulty; corridors shrink.
    const base = 3 + Math.round(ctx.age * 0.9) + ctx.difficulty * 2; // 3y/d1 ≈ 8, 10y/d5 ≈ 22
    const cols = Math.min(24, Math.max(6, base));
    const rows = Math.max(5, Math.round(cols * 0.75));
    return { cols, rows, wall: ctx.render.motorSupport ? 1.4 : 1.0 };
  },

  generate(ctx, params): WorksheetContent {
    const { cols, rows } = params;
    // Available area in mm. The grid keeps square cells, so it rarely fills
    // both axes — the *declared* box is the grid itself, never this envelope,
    // or the sheet would carry phantom margins the page composer can't tell
    // from real content (see the content-box contract in types.ts).
    const MAX_W = 160, MAX_H = 190;
    const cell = Math.min(MAX_W / cols, MAX_H / rows);
    const W = cell * cols, H = cell * rows;

    // Quality invariant: winding solution. Re-carve with forked RNG if short.
    let walls = carve(cols, rows, ctx.rng);
    let solution = solve(walls, cols, rows);
    let attempt = 0;
    while (solution.length < cols * rows * 0.4 && attempt < 5) {
      walls = carve(cols, rows, ctx.rng.fork(`recarve-${attempt}`));
      solution = solve(walls, cols, rows);
      attempt++;
    }

    const stroke = { stroke: "#111", "stroke-width": params.wall, "stroke-linecap": "round" as const };
    const parts: string[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const w = walls[y * cols + x]!;
        const x0 = x * cell, y0 = y * cell;
        if (w & 1) parts.push(line(x0, y0, x0 + cell, y0, stroke));
        if (w & 2) parts.push(line(x0 + cell, y0, x0 + cell, y0 + cell, stroke));
        if (w & 4 && y === rows - 1 && x !== cols - 1) parts.push(line(x0, y0 + cell, x0 + cell, y0 + cell, stroke));
        if (w & 4 && y === rows - 1 && x === cols - 1) {/* exit opening */}
        if (w & 4 && y < rows - 1) parts.push(line(x0, y0 + cell, x0 + cell, y0 + cell, stroke));
        if (w & 8 && !(x === 0 && y === 0)) parts.push(line(x0, y0, x0, y0 + cell, stroke)); // entrance opening at (0,0) west
      }
    }

    // Start / goal markers. Theme layer will later swap these for themed art;
    // v1 uses a friendly dot + star that prints well in low ink.
    const s = solution[0]!, g = solution[solution.length - 1]!;
    const mark = cell * 0.28;
    parts.push(circle(s.x * cell + cell / 2, s.y * cell + cell / 2, mark, { fill: ctx.render.lowInk ? "none" : "#111", stroke: "#111", "stroke-width": 0.8 }));
    parts.push(star(g.x * cell + cell / 2, g.y * cell + cell / 2, mark * 1.2));

    // Answer key: solution as a smooth polyline on a duplicate.
    const sol = solution.map((c) => `${c.x * cell + cell / 2},${c.y * cell + cell / 2}`).join(" L ");
    const answerKey =
      group({}, parts.join("")) +
      path(`M ${sol}`, { fill: "none", stroke: "#d33", "stroke-width": params.wall * 0.9, "stroke-linejoin": "round", "stroke-dasharray": "2 1.5" });

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.maze.instruction",
      answerKey,
    };
  },
};

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return path(`M ${pts.join(" L ")} Z`, { fill: "none", stroke: "#111", "stroke-width": 0.8, "stroke-linejoin": "round" });
}
