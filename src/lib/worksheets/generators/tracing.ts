import type { GeneratorContext, WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, path, smoothPath } from "../svg";

/**
 * TRACING — pre-writing pencil-control rows.
 *
 * Each row is a dashed guide path the child traces left→right, with a
 * start dot (green in color mode, filled in low-ink mode). Path families
 * are procedural waveforms whose amplitude/frequency scale with difficulty,
 * so every sheet is genuinely different while staying age-appropriate:
 * a 2-year-old gets gentle waves, a 6-year-old gets loops and zigzags.
 */

export type TracingParams = {
  rows: number;
  /** Which path families may appear. */
  families: PathFamily[];
  strokeWidth: number;
};

export type PathFamily = "straight" | "wave" | "zigzag" | "bumps" | "loops" | "peaks";

const FAMILY_BY_LEVEL: Record<1 | 2 | 3 | 4 | 5, PathFamily[]> = {
  1: ["straight", "wave"],
  2: ["straight", "wave", "bumps"],
  3: ["wave", "bumps", "zigzag"],
  4: ["wave", "zigzag", "peaks", "loops"],
  5: ["zigzag", "peaks", "loops"],
};

function buildRow(family: PathFamily, rng: GeneratorContext["rng"], x0: number, x1: number, cy: number, amp: number): string {
  const w = x1 - x0;
  switch (family) {
    case "straight":
      return `M ${x0} ${cy} L ${x1} ${cy}`;
    case "wave": {
      const n = rng.int(3, 5);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i <= n * 2; i++) {
        pts.push([x0 + (w * i) / (n * 2), cy + (i % 2 === 0 ? 0 : (i % 4 === 1 ? -amp : amp))]);
      }
      return smoothPath(pts);
    }
    case "zigzag": {
      const n = rng.int(4, 7);
      let d = `M ${x0} ${cy + amp}`;
      for (let i = 1; i <= n; i++) {
        d += ` L ${(x0 + (w * i) / n).toFixed(2)} ${i % 2 === 1 ? cy - amp : cy + amp}`;
      }
      return d;
    }
    case "bumps": {
      const n = rng.int(4, 6);
      const r = w / (n * 2);
      let d = `M ${x0} ${cy}`;
      for (let i = 0; i < n; i++) d += ` A ${r} ${amp} 0 0 1 ${(x0 + (i + 1) * 2 * r).toFixed(2)} ${cy}`;
      return d;
    }
    case "peaks": {
      const n = rng.int(3, 5);
      let d = `M ${x0} ${cy + amp}`;
      for (let i = 0; i < n; i++) {
        const xa = x0 + (w * (i + 0.5)) / n;
        const xb = x0 + (w * (i + 1)) / n;
        d += ` L ${xa.toFixed(2)} ${cy - amp} L ${xb.toFixed(2)} ${cy + amp}`;
      }
      return d;
    }
    case "loops": {
      const n = rng.int(3, 4);
      const step = w / n;
      let d = `M ${x0} ${cy + amp * 0.6}`;
      for (let i = 0; i < n; i++) {
        const cx = x0 + step * (i + 0.5);
        d += ` C ${(cx - step * 0.1).toFixed(2)} ${cy + amp}, ${(cx + step * 0.55).toFixed(2)} ${cy - amp}, ${cx.toFixed(2)} ${(cy - amp * 0.9).toFixed(2)}`;
        d += ` C ${(cx - step * 0.55).toFixed(2)} ${cy - amp}, ${(cx + step * 0.1).toFixed(2)} ${cy + amp}, ${(x0 + step * (i + 1)).toFixed(2)} ${(cy + amp * 0.6).toFixed(2)}`;
      }
      return d;
    }
  }
}

export const tracingGenerator: WorksheetGenerator<TracingParams> = {
  id: "tracing",
  version: 1,
  goals: ["fine_motor", "pre_writing", "bilateral_coordination"],
  ageRange: [2, 7],

  defaultParams(ctx): TracingParams {
    return {
      rows: ctx.age <= 3 ? 4 : ctx.age <= 5 ? 5 : 6,
      families: FAMILY_BY_LEVEL[ctx.difficulty],
      strokeWidth: ctx.render.motorSupport || ctx.age <= 3 ? 1.6 : 1.1,
    };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160, H = 200;
    const rowH = H / params.rows;
    const amp = Math.min(rowH * 0.3, ctx.age <= 3 ? 14 : 10);
    const parts: string[] = [];

    // Shuffle so the same families don't always appear in the same order.
    const order = ctx.rng.shuffle(
      Array.from({ length: params.rows }, (_, i) => params.families[i % params.families.length]!),
    );

    order.forEach((family, i) => {
      const cy = rowH * i + rowH / 2;
      const rowRng = ctx.rng.fork(`row-${i}`);
      const d = buildRow(family, rowRng, 14, W - 6, cy, amp);
      parts.push(
        path(d, {
          fill: "none",
          stroke: "#555",
          "stroke-width": params.strokeWidth,
          "stroke-dasharray": "3 2.5",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        }),
      );
      // Start dot — tells the child (and a left-to-right reading habit) where to begin.
      const startY = family === "zigzag" || family === "peaks" || family === "loops" ? cy + amp * (family === "loops" ? 0.6 : 1) : cy;
      parts.push(circle(9, startY, 2.6, { fill: ctx.render.lowInk ? "#111" : "#2f9e44" }));
    });

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.tracing.instruction",
    };
  },
};
