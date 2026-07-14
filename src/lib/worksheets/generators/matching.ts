import type { WorksheetGenerator, WorksheetContent } from "../types";
import { circle, group, path, rect } from "../svg";

/**
 * MATCHING PAIRS — draw a line from each shape to its filled silhouette.
 *
 * Trains visual perception (form constancy) and scanning. Left column:
 * outline shapes; right column: the same shapes as solid silhouettes in a
 * shuffled order. Difficulty adds pairs and, from d3, near-miss distractor
 * shapes (a silhouette with no partner) that force careful comparison.
 * The answer key draws the connecting lines.
 */

export type MatchingParams = {
  pairs: number;
  /** Extra unmatched silhouettes on the right (d≥3). */
  distractors: number;
};

type Shape = (cx: number, cy: number, r: number, fill: boolean) => string;
const s = (fill: boolean) =>
  fill
    ? { fill: "#111", stroke: "none" }
    : { fill: "none", stroke: "#111", "stroke-width": 1.0, "stroke-linejoin": "round" as const };

const SHAPES: Shape[] = [
  (x, y, r, f) => circle(x, y, r, s(f)),
  (x, y, r, f) => rect(x - r, y - r, 2 * r, 2 * r, { ...s(f), rx: r * 0.18 }),
  (x, y, r, f) => path(`M ${x} ${y - r} L ${x + r} ${y + r * 0.85} L ${x - r} ${y + r * 0.85} Z`, s(f)),
  (x, y, r, f) => path(`M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`, s(f)),
  (x, y, r, f) => path(starD(x, y, r), s(f)),
  (x, y, r, f) => path(heartD(x, y, r), s(f)),
  (x, y, r, f) => path(`M ${x - r} ${y + r * 0.7} L ${x - r} ${y - r * 0.3} L ${x} ${y - r} L ${x + r} ${y - r * 0.3} L ${x + r} ${y + r * 0.7} Z`, s(f)), // house
  (x, y, r, f) => path(crescentD(x, y, r), s(f)),
];

function starD(cx: number, cy: number, r: number): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `M ${p.join(" L ")} Z`;
}
function heartD(cx: number, cy: number, r: number): string {
  return `M ${cx} ${cy + r} C ${cx - r * 1.4} ${cy - r * 0.1}, ${cx - r * 0.7} ${cy - r * 1.1}, ${cx} ${cy - r * 0.35} C ${cx + r * 0.7} ${cy - r * 1.1}, ${cx + r * 1.4} ${cy - r * 0.1}, ${cx} ${cy + r} Z`;
}
function crescentD(cx: number, cy: number, r: number): string {
  return `M ${cx + r * 0.4} ${cy - r * 0.9} A ${r} ${r} 0 1 0 ${cx + r * 0.4} ${cy + r * 0.9} A ${r * 0.72} ${r * 0.72} 0 1 1 ${cx + r * 0.4} ${cy - r * 0.9} Z`;
}

export const matchingGenerator: WorksheetGenerator<MatchingParams> = {
  id: "matching",
  version: 1,
  goals: ["visual_perception", "attention", "problem_solving"],
  ageRange: [3, 8],

  defaultParams(ctx): MatchingParams {
    return {
      pairs: Math.min(6, 3 + Math.floor(ctx.difficulty / 2) + (ctx.age >= 5 ? 1 : 0)),
      distractors: ctx.difficulty >= 3 ? 1 : 0,
    };
  },

  generate(ctx, params): WorksheetContent {
    const W = 160, H = 185;
    const leftX = 26, rightX = W - 26;
    const shapes = ctx.rng.shuffle(SHAPES).slice(0, params.pairs + params.distractors);
    const leftShapes = shapes.slice(0, params.pairs);

    // Right column: pairs + distractors, shuffled; remember target rows.
    const rightItems = ctx.rng.shuffle(
      shapes.map((shape, i) => ({ shape, isPair: i < params.pairs, pairIndex: i })),
    );

    const rightCount = rightItems.length;
    const rowHL = H / params.pairs;
    const rowHR = H / rightCount;
    const r = Math.min(9, rowHL * 0.28, rowHR * 0.34);

    const parts: string[] = [];
    const lines: string[] = [];

    leftShapes.forEach((shape, i) => {
      const y = rowHL * i + rowHL / 2;
      parts.push(shape(leftX, y, r, false));
      const target = rightItems.findIndex((it) => it.pairIndex === i);
      const ty = rowHR * target + rowHR / 2;
      lines.push(path(`M ${leftX + r + 3} ${y} L ${rightX - r - 3} ${ty}`, {
        stroke: "#d33", "stroke-width": 0.8, "stroke-dasharray": "2 1.5", fill: "none",
      }));
    });

    rightItems.forEach((it, i) => {
      const y = rowHR * i + rowHR / 2;
      parts.push(it.shape(rightX, y, r, true));
    });

    return {
      body: group({}, parts.join("")),
      width: W,
      height: H,
      instructionKey: "worksheet.matching.instruction",
      answerKey: group({}, parts.join("") + lines.join("")),
    };
  },
};
