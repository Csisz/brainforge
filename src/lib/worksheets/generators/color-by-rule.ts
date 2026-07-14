import type { GeneratorContext, WorksheetGenerator, WorksheetContent } from "../types";
import { group, line, path, rect, text } from "../svg";

/**
 * COLOR BY RULE — a colour-by-number stained-glass panel.
 *
 * A few straight "leading" lines cross the panel, cutting it into convex
 * regions. Each region carries a number; a legend maps every number to a
 * localized colour word. The child colours each region by its number. Trains
 * attention, one-to-one rule following and fine-motor colouring. Difficulty
 * scales the number of lines (regions) and colours. No answer key — the
 * legend is the key.
 *
 * Region labelling is done by point-signature sampling: because every line
 * fully crosses the panel, the cells are convex, so a region's centroid is
 * always inside it — a robust way to place a label without polygon geometry.
 */

export type ColorByRuleParams = {
  lines: number;
  colors: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const PALETTE = [
  { hex: "#e23b3b", hu: "piros", en: "red", de: "rot" },
  { hex: "#2f6fd0", hu: "kék", en: "blue", de: "blau" },
  { hex: "#3a9d4a", hu: "zöld", en: "green", de: "grün" },
  { hex: "#e8b800", hu: "sárga", en: "yellow", de: "gelb" },
  { hex: "#e8791f", hu: "narancs", en: "orange", de: "orange" },
  { hex: "#8a4fb0", hu: "lila", en: "purple", de: "lila" },
];
const word = (i: number, locale: string) => {
  const c = PALETTE[i]!;
  return (locale === "hu" ? c.hu : locale === "de" ? c.de : c.en);
};

type Seg = { x1: number; y1: number; x2: number; y2: number };

/** A random line fully crossing the [0,w]×[0,h] box (endpoints on two edges). */
function crossingLine(w: number, h: number, ctx: GeneratorContext): Seg {
  const edgePoint = (edge: number): [number, number] => {
    const s = ctx.rng.next();
    if (edge === 0) return [s * w, 0];
    if (edge === 1) return [w, s * h];
    if (edge === 2) return [s * w, h];
    return [0, s * h];
  };
  const e1 = ctx.rng.int(0, 3);
  let e2 = ctx.rng.int(0, 3);
  if (e2 === e1) e2 = (e2 + 1 + ctx.rng.int(0, 2)) % 4;
  const [x1, y1] = edgePoint(e1);
  const [x2, y2] = edgePoint(e2);
  return { x1, y1, x2, y2 };
}

export const colorByRuleGenerator: WorksheetGenerator<ColorByRuleParams> = {
  id: "color_by_rule",
  version: 1,
  goals: ["attention", "fine_motor", "pre_reading"],
  ageRange: [3, 8],

  defaultParams(ctx): ColorByRuleParams {
    return {
      lines: clamp(3 + Math.floor(ctx.difficulty / 2) + (ctx.age >= 6 ? 1 : 0), 3, 6),
      colors: clamp(3 + Math.floor((ctx.difficulty - 1) / 2), 3, 6),
    };
  },

  generate(ctx, params): WorksheetContent {
    const W = 170;
    const legendH = 16;
    const panelH = 190;
    const H = legendH + panelH;
    const K = Math.min(params.colors, PALETTE.length);

    const segs = Array.from({ length: params.lines }, () => crossingLine(W, panelH, ctx));
    const sideOf = (s: Seg, x: number, y: number) => (s.x2 - s.x1) * (y - s.y1) - (s.y2 - s.y1) * (x - s.x1) >= 0;

    // Sample the panel, group points by their line-signature into regions.
    const step = 2.2;
    const regions = new Map<string, { sx: number; sy: number; n: number }>();
    for (let x = step / 2; x < W; x += step) {
      for (let y = step / 2; y < panelH; y += step) {
        let sig = "";
        for (const s of segs) sig += sideOf(s, x, y) ? "1" : "0";
        const reg = regions.get(sig) ?? { sx: 0, sy: 0, n: 0 };
        reg.sx += x;
        reg.sy += y;
        reg.n += 1;
        regions.set(sig, reg);
      }
    }

    // Keep regions big enough to hold a label; stable order by centroid.
    const cells = [...regions.values()]
      .filter((r) => r.n >= 24)
      .map((r) => ({ cx: r.sx / r.n, cy: r.sy / r.n }))
      .sort((a, b) => a.cy - b.cy || a.cx - b.cx);

    // Assign colour numbers: first K cells guarantee every colour is used.
    const forced = ctx.rng.shuffle(Array.from({ length: K }, (_, i) => i + 1));
    const labels = cells.map((_, i) => (i < K ? forced[i]! : ctx.rng.int(1, K)));

    const leading = segs
      .map((s) => line(s.x1, legendH + s.y1, s.x2, legendH + s.y2, { stroke: "#111", "stroke-width": 1.1, "stroke-linecap": "round" }))
      .join("");
    const panelBorder = rect(0.5, legendH + 0.5, W - 1, panelH - 1, { fill: "none", stroke: "#111", "stroke-width": 1.1 });
    const numbers = cells
      .map((c, i) =>
        text(c.cx, legendH + c.cy + 2.4, String(labels[i]), { "font-size": 7, "font-weight": 700, "text-anchor": "middle", fill: "#555" }),
      )
      .join("");

    // Legend: number = swatch + colour word.
    const colW = W / K;
    const legend: string[] = [];
    for (let i = 0; i < K; i++) {
      const x = colW * i + 3;
      legend.push(text(x, 11, `${i + 1} =`, { "font-size": 6, "font-weight": 700, fill: "#111" }));
      legend.push(rect(x + 11, 4.5, 7, 7, { fill: PALETTE[i]!.hex, stroke: "#111", "stroke-width": 0.3, rx: 1 }));
      legend.push(text(x + 21, 11, word(i, ctx.render.locale), { "font-size": 6, fill: "#111" }));
    }

    return {
      body: group({}, legend.join("") + panelBorder + leading + numbers),
      width: W,
      height: H,
      instructionKey: "worksheet.colorrule.instruction",
    };
  },
};
