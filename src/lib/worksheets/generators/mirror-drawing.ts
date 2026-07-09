import type { GeneratorContext, WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, line, path, smoothPath } from "../svg";

/**
 * MIRROR DRAWING — complete the other half across a vertical axis.
 *
 * Trains bilateral coordination, visual perception and spatial reasoning.
 * The left half shows a procedural figure whose endpoints sit ON the axis
 * (so the child's mirrored stroke connects naturally); the right half is
 * empty except for a faint dot lattice that scaffolds proportion.
 * Difficulty scales stroke count and waypoint density; a light gray
 * "ghost" of the mirrored solution can be enabled for the youngest ages.
 */

export type MirrorParams = {
  strokes: number;
  waypointsPerStroke: number;
  /** Show a faint mirrored ghost as guidance (ages ≤ 4 by default). */
  ghost: boolean;
  latticeStep: number;
};

export const mirrorGenerator: WorksheetGenerator<MirrorParams> = {
  id: "mirror_drawing",
  version: 1,
  goals: ["bilateral_coordination", "visual_perception", "fine_motor", "pre_writing"],
  ageRange: [4, 10],

  defaultParams(ctx): MirrorParams {
    return {
      strokes: 1 + Math.ceil(ctx.difficulty / 2),         // 2..4 strokes
      waypointsPerStroke: 2 + ctx.difficulty,             // 3..7 waypoints
      ghost: ctx.age <= 4,
      latticeStep: ctx.render.motorSupport ? 20 : 16,
    };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160, H = 190;
    const axis = W / 2;
    const parts: string[] = [];
    const mirrored: string[] = [];

    // Faint dot lattice on both halves (proportion scaffold).
    for (let x = params.latticeStep; x < W; x += params.latticeStep) {
      for (let y = params.latticeStep; y < H; y += params.latticeStep) {
        parts.push(circle(x, y, 0.45, { fill: "#d8d8d3" }));
      }
    }

    // Vertical mirror axis.
    parts.push(line(axis, 4, axis, H - 4, { stroke: "#999", "stroke-width": 0.7, "stroke-dasharray": "4 2.5" }));

    // Procedural figure: each stroke starts and ends on the axis, wanders
    // into the left half through sorted-y waypoints (keeps curves tangle-free).
    const bandH = (H - 20) / params.strokes;
    for (let s = 0; s < params.strokes; s++) {
      const rng = ctx.rng.fork(`stroke-${s}`);
      const y0 = 10 + bandH * s + rng.int(0, Math.max(1, Math.round(bandH * 0.2)));
      const y1 = 10 + bandH * (s + 1) - rng.int(0, Math.max(1, Math.round(bandH * 0.2)));
      const pts: Array<[number, number]> = [[axis, y0]];
      for (let i = 1; i <= params.waypointsPerStroke; i++) {
        const y = y0 + ((y1 - y0) * i) / (params.waypointsPerStroke + 1);
        const x = axis - rng.int(Math.round(W * 0.08), Math.round(W * 0.42));
        pts.push([x, y]);
      }
      pts.push([axis, y1]);

      const d = smoothPath(pts);
      const style = { fill: "none", stroke: "#111", "stroke-width": ctx.render.motorSupport ? 1.5 : 1.2, "stroke-linecap": "round" as const };
      parts.push(path(d, style));

      const mirrorPts = pts.map(([x, y]) => [2 * axis - x, y] as [number, number]);
      const md = smoothPath(mirrorPts);
      if (params.ghost) {
        parts.push(path(md, { ...style, stroke: "#dcdcd6" }));
      }
      mirrored.push(path(md, { ...style, stroke: "#d33", "stroke-dasharray": "2 1.5" }));
    }

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.mirror.instruction",
      answerKey: group({}, parts.join("") + mirrored.join("")),
    };
  },
};
