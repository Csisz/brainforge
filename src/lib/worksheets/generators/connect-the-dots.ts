import type { WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, path, text } from "../svg";

/**
 * CONNECT THE DOTS — join numbered dots to reveal a shape.
 *
 * Trains number sequencing, counting and pencil control. The figure is a
 * procedural radial blob: points around a center with jittered radius and
 * angle, so every sheet reveals a different "creature". Dot count scales
 * with age/difficulty (6 at the easiest to 28 at the hardest). Numbers sit
 * OUTSIDE the shape (along the outward normal) so drawn lines never cross
 * the labels.
 */

export type DotsParams = {
  dots: number;
  /** Label font size in mm. */
  labelSize: number;
};

export const connectDotsGenerator: WorksheetGenerator<DotsParams> = {
  id: "connect_the_dots",
  version: 1,
  goals: ["math_thinking", "fine_motor", "attention", "pre_writing"],
  ageRange: [4, 10],

  defaultParams(ctx): DotsParams {
    const dots = Math.min(28, Math.max(6, Math.round(4 + ctx.age * 1.2 + ctx.difficulty * 2.5)));
    return { dots, labelSize: ctx.age <= 5 ? 5.5 : 4.5 };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160, H = 180;
    const cx = W / 2, cy = H / 2;
    const baseR = Math.min(W, H) * 0.36;

    // Radial blob: angles roughly even with jitter, radius wanders smoothly.
    const pts: Array<[number, number]> = [];
    let r = baseR;
    for (let i = 0; i < params.dots; i++) {
      const rng = ctx.rng.fork(`pt-${i}`);
      const a = (i / params.dots) * Math.PI * 2 + rng.next() * ((Math.PI * 2) / params.dots) * 0.45;
      // Smooth radius walk, clamped so the shape stays plausible and inside.
      r = Math.max(baseR * 0.55, Math.min(baseR * 1.15, r + (rng.next() - 0.5) * baseR * 0.45));
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }

    const parts: string[] = [];
    pts.forEach(([x, y], i) => {
      parts.push(circle(x, y, 1.3, { fill: "#111" }));
      // Label along the outward normal from the centroid.
      const dx = x - cx, dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      const lx = x + (dx / len) * 5.5;
      const ly = y + (dy / len) * 5.5;
      parts.push(text(lx, ly + params.labelSize * 0.35, String(i + 1), {
        "font-size": params.labelSize, "font-weight": 600, "text-anchor": "middle", fill: "#111",
      }));
    });
    // Start marker ring around dot 1.
    parts.push(circle(pts[0]![0], pts[0]![1], 2.6, { fill: "none", stroke: "#111", "stroke-width": 0.5 }));

    const solution = path(
      `M ${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ")} Z`,
      { fill: "none", stroke: "#d33", "stroke-width": 0.9, "stroke-dasharray": "2 1.5", "stroke-linejoin": "round" },
    );

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.dots.instruction",
      answerKey: group({}, parts.join("") + solution),
    };
  },
};
