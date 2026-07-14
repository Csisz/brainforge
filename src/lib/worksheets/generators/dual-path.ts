import type { WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, path, text } from "../svg";

/**
 * DUAL PATH ("Itt-Ott" style) — both hands draw at the same time.
 *
 * Header shows a color sequence; below are two fields (left hand / right
 * hand), each containing the same colored dots at different random
 * positions. The child connects the colors in the given order in BOTH
 * fields SIMULTANEOUSLY, one marker per hand. Trains bilateral
 * coordination, divided attention and sequencing.
 *
 * Color is load-bearing here, so this sheet is exempt from lowInk dot
 * fills; in lowInk mode we shrink dots and add the color's index number
 * inside so a grayscale print stays playable.
 */

export type DualPathParams = {
  /** Sequence length (also = dots per field). */
  colors: number;
};

const PALETTE: Array<{ hex: string; nameKey: string }> = [
  { hex: "#2f9e44", nameKey: "green" },
  { hex: "#f08c00", nameKey: "orange" },
  { hex: "#e03131", nameKey: "red" },
  { hex: "#1b3a6b", nameKey: "navy" },
  { hex: "#6741d9", nameKey: "purple" },
  { hex: "#1c7ed6", nameKey: "blue" },
  { hex: "#f5c211", nameKey: "yellow" },
  { hex: "#7f4f24", nameKey: "brown" },
];

export const dualPathGenerator: WorksheetGenerator<DualPathParams> = {
  id: "dual_path",
  version: 1,
  goals: ["bilateral_coordination", "attention", "executive_function"],
  ageRange: [5, 10],

  defaultParams(ctx): DualPathParams {
    return { colors: Math.min(8, 3 + ctx.difficulty + (ctx.age >= 7 ? 1 : 0)) }; // 4..8
  },

  generate(ctx, params): WorksheetContent {
    const W = 160, H = 190;
    const headerH = 16;
    const seq = ctx.rng.shuffle(PALETTE).slice(0, params.colors);

    const parts: string[] = [];
    const answers: string[] = [];

    // Header: the color sequence with arrows.
    const step = Math.min(16, (W - 20) / params.colors);
    const seqX = (W - step * (params.colors - 1)) / 2;
    seq.forEach((c, i) => {
      const x = seqX + i * step;
      parts.push(circle(x, headerH / 2, 3.4, { fill: c.hex }));
      if (i < params.colors - 1) {
        parts.push(path(`M ${x + 4.8} ${headerH / 2} L ${x + step - 4.8} ${headerH / 2} M ${x + step - 6.8} ${headerH / 2 - 1.6} L ${x + step - 4.8} ${headerH / 2} L ${x + step - 6.8} ${headerH / 2 + 1.6}`, {
          stroke: "#111", "stroke-width": 0.6, fill: "none", "stroke-linecap": "round",
        }));
      }
    });
    parts.push(path(`M 2 ${headerH + 2} L ${W - 2} ${headerH + 2}`, { stroke: "#e5e5e0", "stroke-width": 0.3, fill: "none" }));

    // Two fields with a center divider.
    const fieldY = headerH + 6;
    const fieldH = H - fieldY;
    const fieldW = W / 2 - 5;
    parts.push(path(`M ${W / 2} ${fieldY} L ${W / 2} ${H}`, { stroke: "#111", "stroke-width": 0.5, fill: "none" }));

    const dotR = ctx.render.lowInk ? 3.6 : 4.6;

    for (const side of [0, 1] as const) {
      const rng = ctx.rng.fork(`field-${side}`);
      const x0 = side === 0 ? 2 : W / 2 + 3;

      // Jittered-grid placement: enough cells for the dots, no overlaps.
      const cols = 3, rows = Math.max(3, Math.ceil(params.colors / 2));
      const cellW = fieldW / cols, cellH = fieldH / rows;
      const cells = rng.shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, params.colors);

      const positions: Array<[number, number]> = [];
      cells.forEach((cell, i) => {
        const cx = x0 + (cell % cols) * cellW + cellW / 2 + rng.int(-Math.floor(cellW * 0.16), Math.floor(cellW * 0.16));
        const cy = fieldY + Math.floor(cell / cols) * cellH + cellH / 2 + rng.int(-Math.floor(cellH * 0.14), Math.floor(cellH * 0.14));
        positions.push([cx, cy]);
        parts.push(circle(cx, cy, dotR, { fill: seq[i]!.hex }));
        if (ctx.render.lowInk) {
          parts.push(text(cx, cy + 1.4, String(i + 1), { "font-size": 3.6, "font-weight": 700, "text-anchor": "middle", fill: "#fff" }));
        }
      });

      answers.push(path(
        `M ${positions.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ")}`,
        { fill: "none", stroke: "#111", "stroke-width": 0.9, "stroke-dasharray": "2.5 1.8", "stroke-linejoin": "round" },
      ));
    }

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.dualpath.instruction",
      answerKey: group({}, parts.join("") + answers.join("")),
    };
  },
};
