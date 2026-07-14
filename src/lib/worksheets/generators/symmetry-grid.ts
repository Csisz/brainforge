import type { WorksheetGenerator, WorksheetContent } from "../types";
import { group, path, rect } from "../svg";

/**
 * SYMMETRY GRID — color the mirrored cells on the other side of the axis.
 *
 * The grid-based little sibling of mirror drawing: instead of freehand
 * curves, the child fills whole cells, which makes symmetry accessible from
 * age 3–4. The left half shows a random-but-connected cell pattern; the
 * right half is empty. Difficulty scales grid size and filled-cell count.
 * Connectivity matters pedagogically: scattered lone cells read as noise,
 * a connected blob reads as "half a picture".
 */

export type SymmetryGridParams = {
  cols: number;   // per half
  rows: number;
  filled: number;
};

export const symmetryGridGenerator: WorksheetGenerator<SymmetryGridParams> = {
  id: "symmetry_grid",
  version: 1,
  goals: ["visual_perception", "bilateral_coordination", "attention", "fine_motor"],
  ageRange: [3, 8],

  defaultParams(ctx): SymmetryGridParams {
    const size = 3 + Math.ceil(ctx.difficulty / 2) + (ctx.age >= 6 ? 1 : 0); // 4..7
    return {
      cols: Math.min(7, size),
      rows: Math.min(8, size + 1),
      filled: Math.round(size * size * 0.35),
    };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160, H = 185;
    const cell = Math.min((W / 2 - 4) / params.cols, (H - 4) / params.rows);
    const gridW = cell * params.cols;
    const gridH = cell * params.rows;
    const axisX = W / 2;
    const leftX = axisX - gridW;
    const topY = (H - gridH) / 2;

    // Grow a connected blob from a random cell (random BFS frontier).
    const filled = new Set<number>();
    const idx = (c: number, r: number) => r * params.cols + c;
    let frontier = [idx(ctx.rng.int(0, params.cols - 1), ctx.rng.int(0, params.rows - 1))];
    filled.add(frontier[0]!);
    let guard = 0;
    while (filled.size < params.filled && frontier.length && guard++ < 500) {
      const cur = ctx.rng.pick(frontier);
      const c = cur % params.cols, r = Math.floor(cur / params.cols);
      const neighbors = [
        [c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1],
      ].filter(([nc, nr]) => nc! >= 0 && nr! >= 0 && nc! < params.cols && nr! < params.rows && !filled.has(idx(nc!, nr!)));
      if (!neighbors.length) {
        frontier = frontier.filter((f) => f !== cur);
        continue;
      }
      const [nc, nr] = ctx.rng.pick(neighbors);
      const ni = idx(nc!, nr!);
      filled.add(ni);
      frontier.push(ni);
    }

    const parts: string[] = [];
    const answers: string[] = [];

    // Filled cells (left) + mirrored answer cells (right).
    for (const i of filled) {
      const c = i % params.cols, r = Math.floor(i / params.cols);
      const lx = leftX + c * cell;
      const y = topY + r * cell;
      parts.push(rect(lx, y, cell, cell, { fill: "#111" }));
      const mx = axisX + (params.cols - 1 - c) * cell;
      answers.push(rect(mx, y, cell, cell, { fill: "#d33", opacity: 0.85 }));
    }

    // Grid lines over both halves.
    const gridLines: string[] = [];
    for (let c = 0; c <= params.cols * 2; c++) {
      const x = leftX + c * cell;
      gridLines.push(path(`M ${x} ${topY} L ${x} ${topY + gridH}`, { stroke: "#999", "stroke-width": 0.35, fill: "none" }));
    }
    for (let r = 0; r <= params.rows; r++) {
      const y = topY + r * cell;
      gridLines.push(path(`M ${leftX} ${y} L ${leftX + gridW * 2} ${y}`, { stroke: "#999", "stroke-width": 0.35, fill: "none" }));
    }
    // Mirror axis.
    gridLines.push(path(`M ${axisX} ${topY - 3} L ${axisX} ${topY + gridH + 3}`, {
      stroke: "#111", "stroke-width": 0.9, "stroke-dasharray": "3 2", fill: "none",
    }));

    const bodyParts = parts.join("") + gridLines.join("");
    return {
      body: group({}, bodyParts),
      width: W,
      height: H,
      instructionKey: "worksheet.symmetry.instruction",
      answerKey: group({}, bodyParts + answers.join("")),
    };
  },
};
