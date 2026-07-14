import type { WorksheetGenerator, WorksheetContent } from "../types";
import { group, path, rect } from "../svg";
import { GLYPHS, GLYPH_COUNT, outline } from "./glyph-set";

/**
 * MEMORY CARDS — a printable cut-out pairs game.
 *
 * N pairs of simple line-art glyphs laid on a grid of dashed cut-cards.
 * The parent cuts along the dashed lines, and the pair of pages (fronts +
 * the card-back pattern page) becomes a classic concentration game. Trains
 * working memory and visual matching. Pair count scales with age/difficulty
 * (4 pairs for the youngest, up to 10). The "answer key" slot carries the
 * card-back pattern to print on the reverse — so no separate solution exists.
 */

export type MemoryCardsParams = {
  pairs: number;
  cols: number;
};

const CUT = { fill: "none", stroke: "#111", "stroke-width": 0.5, "stroke-dasharray": "2 1.5", rx: 2 } as const;

export const memoryCardsGenerator: WorksheetGenerator<MemoryCardsParams> = {
  id: "memory_cards",
  version: 1,
  goals: ["working_memory", "visual_perception", "attention"],
  ageRange: [3, 9],

  defaultParams(ctx): MemoryCardsParams {
    // 4 pairs (age 3 / easy) → 10 pairs (older / hard), capped by the alphabet.
    const pairs = Math.min(GLYPH_COUNT, 4 + Math.floor((ctx.age - 3) / 2) + Math.floor(ctx.difficulty / 2));
    return { pairs: Math.max(4, Math.min(10, pairs)), cols: 4 };
  },

  generate(ctx, params): WorksheetContent {
    const W = 170;
    const cols = params.cols;
    const count = params.pairs * 2;
    const rows = Math.ceil(count / cols);
    const cardW = W / cols;
    const cardH = cardW;
    const H = rows * cardH;

    // Choose distinct glyphs, duplicate into a deck, shuffle onto the grid.
    const chosen = ctx.rng.shuffle(GLYPHS).slice(0, params.pairs);
    const deck = ctx.rng.shuffle([...chosen, ...chosen]);

    const r = cardW * 0.26;
    const cards: string[] = [];
    deck.forEach((glyph, i) => {
      const c = i % cols;
      const row = Math.floor(i / cols);
      const x = c * cardW;
      const y = row * cardH;
      cards.push(rect(x + 1.5, y + 1.5, cardW - 3, cardH - 3, CUT));
      cards.push(glyph.draw(x + cardW / 2, y + cardH / 2, r, outline(1.1)));
    });

    // Card-back pattern page: the same cut grid, each card filled with a
    // simple concentric motif so backs are indistinguishable when face-down.
    const backs: string[] = [];
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const row = Math.floor(i / cols);
      const x = c * cardW;
      const y = row * cardH;
      backs.push(rect(x + 1.5, y + 1.5, cardW - 3, cardH - 3, CUT));
      const cx = x + cardW / 2;
      const cy = y + cardH / 2;
      backs.push(
        path(
          `M ${cx - r} ${cy} L ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} Z ` +
            `M ${cx - r * 0.55} ${cy} L ${cx} ${cy - r * 0.55} L ${cx + r * 0.55} ${cy} L ${cx} ${cy + r * 0.55} Z`,
          outline(0.7),
        ),
      );
    }

    return {
      body: group({}, cards.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.memorycards.instruction",
      answerKey: group({}, backs.join("")),
    };
  },
};
