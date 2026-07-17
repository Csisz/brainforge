import type { WorksheetGenerator, WorksheetContent } from "../types";
import { group, path, rect, text } from "../svg";
import { themeGlyphs } from "../theme-glyphs";

/**
 * COUNTING — count the objects in each row, write the number in the box.
 *
 * Early math: one-to-one correspondence and numeral writing. Each row shows
 * a scattered (non-overlapping, jittered-grid) group of one glyph kind and
 * an answer box. Counts never repeat within a sheet and scale with
 * age/difficulty (1–5 for the youngest up to 6–15). The answer key writes
 * the numbers in red.
 */

export type CountingParams = {
  rows: number;
  minCount: number;
  maxCount: number;
};

const LINE = { fill: "none", stroke: "#111", "stroke-width": 0.9, "stroke-linejoin": "round" as const, "stroke-linecap": "round" as const };

export const countingGenerator: WorksheetGenerator<CountingParams> = {
  id: "counting",
  version: 2, // v2: themed count glyphs (Sprint 7 M5b)
  goals: ["math_thinking", "attention", "pre_writing"],
  ageRange: [3, 7],

  defaultParams(ctx): CountingParams {
    const top = Math.min(15, 3 + ctx.age + ctx.difficulty);
    return { rows: 4, minCount: Math.max(1, top - 8), maxCount: top };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160, H = 190;
    const rowH = H / params.rows;
    const boxW = 22;
    const fieldW = W - boxW - 10;
    const parts: string[] = [];
    const answers: string[] = [];

    // Distinct counts per row.
    const range = Array.from(
      { length: params.maxCount - params.minCount + 1 },
      (_, i) => params.minCount + i,
    );
    const counts = ctx.rng.shuffle(range).slice(0, params.rows);
    while (counts.length < params.rows) counts.push(ctx.rng.int(params.minCount, params.maxCount));

    // Themed count objects (nature: leaf/flower/sun…, space: star/rocket/planet…,
    // ocean: fish/shell/drop…; other themes keep the neutral shapes).
    const glyphs = themeGlyphs(ctx.theme);
    counts.forEach((count, row) => {
      const rng = ctx.rng.fork(`row-${row}`);
      const glyph = rng.pick(glyphs);
      const y0 = row * rowH;
      const r = Math.min(6, rowH * 0.16);

      // Jittered grid placement — no overlaps, honest scatter.
      const cols = Math.ceil(Math.sqrt(count * (fieldW / rowH)));
      const rows = Math.ceil(count / cols);
      const cellW = fieldW / cols;
      const cellH = (rowH - 8) / rows;
      const cells = rng.shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, count);
      for (const cell of cells) {
        const cxCell = (cell % cols) * cellW + cellW / 2 + rng.int(-Math.floor(cellW * 0.18), Math.floor(cellW * 0.18));
        const cyCell = y0 + 4 + Math.floor(cell / cols) * cellH + cellH / 2 + rng.int(-Math.floor(cellH * 0.15), Math.floor(cellH * 0.15));
        parts.push(glyph(4 + cxCell, cyCell, r, LINE));
      }

      // Answer box.
      const bx = W - boxW, by = y0 + rowH / 2 - boxW / 2;
      parts.push(rect(bx, by, boxW, boxW, { fill: "none", stroke: "#111", "stroke-width": 0.8, rx: 2.5 }));
      answers.push(text(bx + boxW / 2, by + boxW * 0.68, String(count), {
        "font-size": boxW * 0.55, "font-weight": 700, "text-anchor": "middle", fill: "#d33",
      }));
      // Row separator.
      if (row > 0) parts.push(path(`M 2 ${y0} L ${W - 2} ${y0}`, { stroke: "#e5e5e0", "stroke-width": 0.3, fill: "none" }));
    });

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.counting.instruction",
      answerKey: group({}, parts.join("") + answers.join("")),
    };
  },
};
