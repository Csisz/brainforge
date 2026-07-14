import type { WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, line, path, rect } from "../svg";
import { GLYPHS, outline } from "./glyph-set";

/**
 * CUT & PASTE — complete the pattern with cut-out pieces.
 *
 * A repeating shape pattern runs across the top with a few cells left blank
 * (dashed gaps). Below a scissors cut-line sit the missing pieces as cut-out
 * cards in shuffled order; the child cuts them out and pastes each into the
 * right gap. Trains pattern recognition (like pattern_completion) plus the
 * fine-motor work of cutting. Difficulty scales the pattern period, the row
 * count and how many pieces are missing. The answer key fills the gaps in red.
 */

export type CutPasteParams = {
  rows: number;
  cols: number;
  period: number;
  blanks: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Small scissors mark drawn around (x, y). */
function scissors(x: number, y: number): string {
  const st = outline(0.7);
  return (
    circle(x - 2.2, y + 2.6, 1.5, st) +
    circle(x + 2.2, y + 2.6, 1.5, st) +
    path(`M ${x - 1.4} ${y + 1.6} L ${x + 3.2} ${y - 4}`, st) +
    path(`M ${x + 1.4} ${y + 1.6} L ${x - 3.2} ${y - 4}`, st) +
    circle(x, y + 0.6, 0.5, { fill: "#111" })
  );
}

export const cutAndPasteGenerator: WorksheetGenerator<CutPasteParams> = {
  id: "cut_and_paste",
  version: 1,
  goals: ["fine_motor", "visual_perception", "math_thinking"],
  ageRange: [3, 8],

  defaultParams(ctx): CutPasteParams {
    // cols is kept a multiple of period so every pattern glyph repeats at least
    // twice — that's what makes the missing cell inferable.
    const period = ctx.difficulty >= 3 ? 3 : 2;
    const cols = period === 3 ? 6 : ctx.age >= 6 ? 6 : 4;
    const rows = ctx.difficulty >= 4 ? 3 : 2;
    return { rows, cols, period, blanks: clamp(2 + Math.floor(ctx.difficulty / 1.5), 3, 6) };
  },

  generate(ctx, params): WorksheetContent {
    const W = 170;
    const cell = W / params.cols;
    const topH = params.rows * cell;
    const gap = 16;
    const cardW = Math.min(cell, W / Math.max(params.blanks, 4)) - 2;
    const bottomH = cardW + 8;
    const H = topH + gap + bottomH;

    // Per-row pattern glyphs (distinct per row so rows look different).
    const rowGlyphs = ctx.rng
      .shuffle(GLYPHS.map((_, i) => i))
      .slice(0, params.rows * params.period);

    const seqAt = (row: number, c: number) => rowGlyphs[row * params.period + (c % params.period)]!;

    // A cell is blankable only if its glyph still appears elsewhere (unblanked)
    // in the same row — otherwise the child could never infer the missing piece.
    // Per row and glyph, keep one occurrence visible; the rest are eligible.
    const eligible: Array<[number, number]> = [];
    for (let row = 0; row < params.rows; row++) {
      const byGlyph = new Map<number, number[]>();
      for (let c = 0; c < params.cols; c++) {
        const g = seqAt(row, c);
        (byGlyph.get(g) ?? byGlyph.set(g, []).get(g)!).push(c);
      }
      for (const cols of byGlyph.values()) {
        const shuffled = ctx.rng.shuffle(cols);
        for (let k = 1; k < shuffled.length; k++) eligible.push([row, shuffled[k]!]);
      }
    }
    const blanks = ctx.rng.shuffle(eligible).slice(0, Math.min(params.blanks, eligible.length));
    const isBlank = (row: number, c: number) => blanks.some(([br, bc]) => br === row && bc === c);

    const r = cell * 0.3;
    const grid: string[] = [];
    const answerFill: string[] = [];
    for (let row = 0; row < params.rows; row++) {
      for (let c = 0; c < params.cols; c++) {
        const x = c * cell;
        const y = row * cell;
        const gi = seqAt(row, c);
        if (isBlank(row, c)) {
          grid.push(rect(x + 2, y + 2, cell - 4, cell - 4, { fill: "none", stroke: "#111", "stroke-width": 0.6, "stroke-dasharray": "2 1.5", rx: 2 }));
          answerFill.push(GLYPHS[gi]!.draw(x + cell / 2, y + cell / 2, r, { ...outline(1.1), stroke: "#d33" }));
        } else {
          grid.push(rect(x + 2, y + 2, cell - 4, cell - 4, { fill: "none", stroke: "#eee", "stroke-width": 0.4, rx: 2 }));
          grid.push(GLYPHS[gi]!.draw(x + cell / 2, y + cell / 2, r, outline(1.1)));
        }
      }
    }

    // Cut line with scissors, then the missing pieces as cut-out cards.
    const cutY = topH + gap / 2;
    const cutLine =
      line(6, cutY, W, cutY, { stroke: "#111", "stroke-width": 0.5, "stroke-dasharray": "3 2" }) + scissors(3, cutY);

    const pieceGlyphs = ctx.rng.shuffle(blanks.map(([row, c]) => seqAt(row, c)));
    const stripY = topH + gap;
    const pieceGap = (W - params.blanks * cardW) / (params.blanks + 1);
    const cards = pieceGlyphs
      .map((gi, i) => {
        const x = pieceGap + i * (cardW + pieceGap);
        return (
          rect(x, stripY, cardW, cardW, { fill: "none", stroke: "#111", "stroke-width": 0.5, "stroke-dasharray": "2 1.5", rx: 2 }) +
          GLYPHS[gi]!.draw(x + cardW / 2, stripY + cardW / 2, cardW * 0.3, outline(1.1))
        );
      })
      .join("");

    return {
      body: group({}, grid.join("") + cutLine + cards),
      width: W,
      height: H,
      instructionKey: "worksheet.cutpaste.instruction",
      answerKey: group({}, grid.join("") + answerFill.join("") + cutLine + cards),
    };
  },
};
