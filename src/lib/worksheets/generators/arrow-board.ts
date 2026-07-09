import type { WorksheetGenerator, WorksheetContent } from "../types";
import { group, path, rect } from "../svg";

/**
 * ARROW BOARD — printable grid of arrows for direction/reaction games.
 *
 * The sheet goes on a wall or door. Play modes (parent-facing, localized in
 * the session UI): "say each direction out loud", "point the OPPOSITE way",
 * "left hand for left arrows, right hand for right" — classic executive-
 * function inhibition drills. Difficulty adds diagonals and density; at d5
 * a few arrows are outlined (rule switch: outlined ⇒ say the opposite).
 */

export type ArrowBoardParams = {
  cols: number;
  rows: number;
  diagonals: boolean;
  /** Fraction of outlined "rule-switch" arrows (0 below d5). */
  trickRatio: number;
};

const DIRS4 = [0, 90, 180, 270];
const DIRS8 = [0, 45, 90, 135, 180, 225, 270, 315];

function arrow(cx: number, cy: number, len: number, angleDeg: number, outlined: boolean): string {
  const stroke = { fill: "none", stroke: "#111", "stroke-width": outlined ? 0.7 : 1.6, "stroke-linecap": "round" as const, "stroke-linejoin": "round" as const };
  const h = len / 2;
  const head = len * 0.32;
  const d = `M ${-h} 0 L ${h} 0 M ${h - head} ${-head * 0.7} L ${h} 0 L ${h - head} ${head * 0.7}`;
  return group({ transform: `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${angleDeg})` }, path(d, stroke));
}

export const arrowBoardGenerator: WorksheetGenerator<ArrowBoardParams> = {
  id: "arrow_board",
  version: 1,
  goals: ["executive_function", "attention", "bilateral_coordination"],
  ageRange: [4, 10],

  defaultParams(ctx): ArrowBoardParams {
    return {
      cols: 2 + Math.ceil(ctx.difficulty / 2),          // 3..5
      rows: 3 + Math.ceil(ctx.difficulty / 2),          // 4..6
      diagonals: ctx.difficulty >= 3,
      trickRatio: ctx.difficulty >= 5 ? 0.2 : 0,
    };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160, H = 200;
    const cellW = W / params.cols;
    const cellH = H / params.rows;
    const dirs = params.diagonals ? DIRS8 : DIRS4;
    const parts: string[] = [];

    let prev = -1;
    for (let r = 0; r < params.rows; r++) {
      for (let c = 0; c < params.cols; c++) {
        const rng = ctx.rng.fork(`a-${r}-${c}`);
        // No two identical directions in a row (keeps the drill demanding).
        let dir = rng.pick(dirs);
        if (dir === prev) dir = dirs[(dirs.indexOf(dir) + 1 + rng.int(0, dirs.length - 2)) % dirs.length]!;
        prev = dir;
        const outlined = rng.chance(params.trickRatio);
        parts.push(arrow(c * cellW + cellW / 2, r * cellH + cellH / 2, Math.min(cellW, cellH) * 0.55, dir, outlined));
      }
    }

    // Light frame so the sheet reads as one board on the wall.
    parts.push(rect(1, 1, W - 2, H - 2, { fill: "none", stroke: "#ddd", "stroke-width": 0.4, rx: 3 }));

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.arrows.instruction",
    };
  },
};
