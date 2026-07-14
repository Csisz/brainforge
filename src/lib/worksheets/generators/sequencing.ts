import type { WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, line, path, rect } from "../svg";

/**
 * SEQUENCING — put the story in order.
 *
 * Each row shows the same simple process at 3–5 stages (a flower growing, a
 * glass filling, a tower rising) drawn parametrically, then shuffled. The
 * child writes 1..N in the box under each frame to restore the order. Trains
 * temporal reasoning, cause-and-effect and early math ordering. Difficulty
 * scales the number of frames and rows. The answer key writes the correct
 * order numbers in red.
 */

export type SequencingParams = {
  rows: number;
  frames: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const LINE = { fill: "none", stroke: "#111", "stroke-width": 1.0, "stroke-linejoin": "round" as const, "stroke-linecap": "round" as const };

type Process = (fx: number, fy: number, fw: number, fh: number, t: number) => string;

/** Flower growing: stem lengthens, bud opens into petals. */
const flower: Process = (fx, fy, fw, fh, t) => {
  const cx = fx + fw / 2;
  const base = fy + fh - 4;
  const stemH = (fh - 10) * clamp(t, 0.12, 1);
  const topY = base - stemH;
  const out = [line(fx + 4, base, fx + fw - 4, base, LINE), path(`M ${cx} ${base} L ${cx} ${topY}`, LINE)];
  if (t > 0.32) out.push(path(`M ${cx} ${base - stemH * 0.5} q 5 -1 6 -4 q -5 -1 -6 4`, LINE)); // leaf
  if (t > 0.62) {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      out.push(circle(cx + Math.cos(a) * 3.4, topY + Math.sin(a) * 3.4, 2.2, LINE));
    }
    out.push(circle(cx, topY, 1.9, LINE));
  } else {
    out.push(circle(cx, topY, 2.2, LINE));
  }
  return out.join("");
};

/** Glass filling: water level rises. */
const cup: Process = (fx, fy, fw, fh, t) => {
  const cx = fx + fw / 2;
  const topY = fy + fh * 0.22;
  const botY = fy + fh - 4;
  const topHalf = fw * 0.26;
  const botHalf = fw * 0.19;
  const halfAt = (yy: number) => {
    const h = (botY - yy) / (botY - topY); // 0 bottom .. 1 top
    return botHalf + (topHalf - botHalf) * h;
  };
  const waterY = botY - (botY - topY) * clamp(t, 0.06, 1);
  const wl = halfAt(waterY);
  const glass = path(`M ${cx - topHalf} ${topY} L ${cx - botHalf} ${botY} L ${cx + botHalf} ${botY} L ${cx + topHalf} ${topY}`, LINE);
  const water = path(
    `M ${cx - botHalf} ${botY} L ${cx + botHalf} ${botY} L ${cx + wl} ${waterY} L ${cx - wl} ${waterY} Z`,
    { fill: "#e6eef4", stroke: "#88a", "stroke-width": 0.4 },
  );
  return water + glass;
};

/** Tower rising: more stacked blocks. */
const tower: Process = (fx, fy, fw, fh, t) => {
  const maxB = 5;
  const n = Math.max(1, Math.round(1 + t * (maxB - 1)));
  const bw = fw * 0.42;
  const bh = (fh * 0.62) / maxB;
  const cx = fx + fw / 2;
  const base = fy + fh - 4;
  const out = [line(fx + 4, base, fx + fw - 4, base, LINE)];
  for (let i = 0; i < n; i++) out.push(rect(cx - bw / 2, base - (i + 1) * bh, bw, bh - 0.8, { ...LINE, rx: 1 }));
  return out.join("");
};

const PROCESSES: Process[] = [flower, cup, tower];

export const sequencingGenerator: WorksheetGenerator<SequencingParams> = {
  id: "sequencing",
  version: 1,
  goals: ["executive_function", "math_thinking", "problem_solving"],
  ageRange: [3, 9],

  defaultParams(ctx): SequencingParams {
    return {
      rows: Math.min(3, PROCESSES.length, 2 + (ctx.difficulty >= 4 ? 1 : 0)),
      frames: clamp(3 + Math.floor((ctx.difficulty - 1) / 2) + (ctx.age >= 6 ? 1 : 0), 3, 5),
    };
  },

  generate(ctx, params): WorksheetContent {
    const W = 170;
    const N = params.frames;
    const gap = 4;
    const frameW = (W - (N + 1) * gap) / N;
    const frameH = frameW * 1.05;
    const boxSize = 9;
    const rowH = frameH + boxSize + 10;
    const H = params.rows * rowH;

    const procs = ctx.rng.shuffle(PROCESSES).slice(0, params.rows);
    const body: string[] = [];
    const answers: string[] = [];

    procs.forEach((proc, row) => {
      const y0 = row * rowH;
      // Chronological stages, then shuffled placement.
      const stages = Array.from({ length: N }, (_, k) => ({ t: k / (N - 1), order: k + 1 }));
      const placed = ctx.rng.shuffle(stages);
      placed.forEach((stage, i) => {
        const x = gap + i * (frameW + gap);
        body.push(rect(x, y0, frameW, frameH, { fill: "none", stroke: "#111", "stroke-width": 0.7, rx: 3 }));
        body.push(proc(x, y0, frameW, frameH, stage.t));
        const bx = x + frameW / 2 - boxSize / 2;
        const by = y0 + frameH + 4;
        body.push(rect(bx, by, boxSize, boxSize, { fill: "none", stroke: "#111", "stroke-width": 0.7, rx: 1.5 }));
        answers.push(
          `<text x="${bx + boxSize / 2}" y="${by + boxSize * 0.72}" font-size="6" font-weight="700" text-anchor="middle" fill="#d33">${stage.order}</text>`,
        );
      });
    });

    return {
      body: group({}, body.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.sequencing.instruction",
      answerKey: group({}, body.join("") + answers.join("")),
    };
  },
};
