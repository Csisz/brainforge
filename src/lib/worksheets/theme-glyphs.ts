import type { ThemeId } from "./types";
import { circle, rect, path } from "./svg";

/**
 * THEME → GLYPH LOOKUP (Sprint 7 M5b)
 * ----------------------------------
 * Generators stay theme-agnostic in *logic* — a maze is still a maze — but the
 * small pictorial marks they draw (what you count, hunt, match; where a maze
 * starts and ends) can wear the session's theme. This module is the only place
 * that knows a "nature" sheet uses leaves and suns; generators just ask for the
 * glyph set for `ctx.theme` and draw it on their own grid.
 *
 * Coverage is deliberately partial (spec: "where cheap and high-impact"):
 * nature, space and ocean have hand-drawn families; every other theme falls back
 * to the neutral geometric set, so nothing ever renders blank. All glyphs are
 * outline-only line art (`Style` carries the stroke), so lowInk/print paths are
 * unaffected.
 */

export type GlyphStyle = Record<string, string | number>;
/** Draw a glyph centred at (cx,cy), fitting within radius r. Outline only. */
export type Glyph = (cx: number, cy: number, r: number, s: GlyphStyle) => string;

const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

// ── neutral geometric set (the pre-theme default) ───────────────────────────
const circleGlyph: Glyph = (x, y, r, s) => circle(x, y, r, s);
const squareGlyph: Glyph = (x, y, r, s) => rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, { ...s, rx: 1 });
const triangleGlyph: Glyph = (x, y, r, s) => path(`M ${n(x)} ${n(y - r)} L ${n(x + r)} ${n(y + r * 0.8)} L ${n(x - r)} ${n(y + r * 0.8)} Z`, s);
const heartGlyph: Glyph = (x, y, r, s) =>
  path(
    `M ${n(x)} ${n(y + r)} C ${n(x - r * 1.4)} ${n(y - r * 0.1)}, ${n(x - r * 0.7)} ${n(y - r * 1.1)}, ${n(x)} ${n(y - r * 0.35)} C ${n(x + r * 0.7)} ${n(y - r * 1.1)}, ${n(x + r * 1.4)} ${n(y - r * 0.1)}, ${n(x)} ${n(y + r)} Z`,
    s,
  );
const starGlyph: Glyph = (x, y, r, s) => {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    p.push(`${n(x + rr * Math.cos(a))},${n(y + rr * Math.sin(a))}`);
  }
  return path(`M ${p.join(" L ")} Z`, s);
};

// ── nature ──────────────────────────────────────────────────────────────────
const leafGlyph: Glyph = (x, y, r, s) =>
  path(
    `M ${n(x)} ${n(y - r)} Q ${n(x + r * 0.95)} ${n(y)} ${n(x)} ${n(y + r)} Q ${n(x - r * 0.95)} ${n(y)} ${n(x)} ${n(y - r)} Z`,
    s,
  ) + path(`M ${n(x)} ${n(y - r * 0.7)} L ${n(x)} ${n(y + r * 0.7)}`, { ...s, "stroke-width": (Number(s["stroke-width"]) || 1) * 0.7 });
const flowerGlyph: Glyph = (x, y, r, s) => {
  const parts = [circle(x, y, r * 0.35, s)];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(circle(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.34, s));
  }
  return parts.join("");
};
const sunGlyph: Glyph = (x, y, r, s) => {
  const parts = [circle(x, y, r * 0.55, s)];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(path(`M ${n(x + Math.cos(a) * r * 0.72)} ${n(y + Math.sin(a) * r * 0.72)} L ${n(x + Math.cos(a) * r)} ${n(y + Math.sin(a) * r)}`, s));
  }
  return parts.join("");
};

// ── space ─────────────────────────────────────────────────────────────────
const rocketGlyph: Glyph = (x, y, r, s) => {
  const w = r * 0.5;
  const body = `M ${n(x - w)} ${n(y + r * 0.35)} L ${n(x - w)} ${n(y - r * 0.2)} Q ${n(x)} ${n(y - r * 1.05)} ${n(x + w)} ${n(y - r * 0.2)} L ${n(x + w)} ${n(y + r * 0.35)} Z`;
  const fins = `M ${n(x - w)} ${n(y + r * 0.1)} L ${n(x - r * 0.95)} ${n(y + r * 0.55)} L ${n(x - w)} ${n(y + r * 0.35)} M ${n(x + w)} ${n(y + r * 0.1)} L ${n(x + r * 0.95)} ${n(y + r * 0.55)} L ${n(x + w)} ${n(y + r * 0.35)}`;
  return path(body, s) + path(fins, s) + circle(x, y - r * 0.15, r * 0.2, s);
};
const planetGlyph: Glyph = (x, y, r, s) =>
  circle(x, y, r * 0.62, s) +
  path(
    `M ${n(x - r)} ${n(y + r * 0.22)} Q ${n(x)} ${n(y + r * 0.72)} ${n(x + r)} ${n(y + r * 0.22)} Q ${n(x)} ${n(y - r * 0.28)} ${n(x - r)} ${n(y + r * 0.22)} Z`,
    s,
  );

// ── ocean ─────────────────────────────────────────────────────────────────
const fishGlyph: Glyph = (x, y, r, s) =>
  path(
    `M ${n(x - r * 0.55)} ${n(y)} C ${n(x - r * 0.55)} ${n(y - r * 0.7)} ${n(x + r)} ${n(y - r * 0.7)} ${n(x + r)} ${n(y)} C ${n(x + r)} ${n(y + r * 0.7)} ${n(x - r * 0.55)} ${n(y + r * 0.7)} ${n(x - r * 0.55)} ${n(y)} Z`,
    s,
  ) +
  path(`M ${n(x - r * 0.55)} ${n(y)} L ${n(x - r)} ${n(y - r * 0.5)} L ${n(x - r)} ${n(y + r * 0.5)} Z`, s) +
  circle(x + r * 0.55, y - r * 0.15, r * 0.12, s);
const shellGlyph: Glyph = (x, y, r, s) => {
  // a scallop fan: hinge at the bottom, a scalloped top edge, ridges fanning up
  const ax = x, ay = y + r * 0.85;
  const topY = y - r * 0.5, rx = r * 0.9;
  const bumps = 4, step = (2 * rx) / bumps;
  let d = `M ${n(ax)} ${n(ay)} L ${n(x - rx)} ${n(topY)}`;
  for (let i = 0; i < bumps; i++) d += ` q ${n(step / 2)} ${n(-r * 0.3)} ${n(step)} 0`;
  d += ` L ${n(ax)} ${n(ay)} Z`;
  const ridgeStyle = { ...s, "stroke-width": (Number(s["stroke-width"]) || 1) * 0.7 };
  const ridges: string[] = [];
  for (let i = 1; i < bumps; i++) ridges.push(path(`M ${n(ax)} ${n(ay)} L ${n(x - rx + i * step)} ${n(topY)}`, ridgeStyle));
  return path(d, s) + ridges.join("");
};
const dropletGlyph: Glyph = (x, y, r, s) =>
  path(
    `M ${n(x)} ${n(y - r)} Q ${n(x + r * 0.85)} ${n(y + r * 0.2)} ${n(x)} ${n(y + r)} Q ${n(x - r * 0.85)} ${n(y + r * 0.2)} ${n(x)} ${n(y - r)} Z`,
    s,
  );

const NEUTRAL: Glyph[] = [circleGlyph, squareGlyph, triangleGlyph, heartGlyph, starGlyph];
const NATURE: Glyph[] = [leafGlyph, flowerGlyph, sunGlyph];
const SPACE: Glyph[] = [starGlyph, rocketGlyph, planetGlyph];
const OCEAN: Glyph[] = [fishGlyph, shellGlyph, dropletGlyph];

function themedFamily(theme: ThemeId): Glyph[] | null {
  if (theme === "nature") return NATURE;
  if (theme === "space") return SPACE;
  if (theme === "ocean") return OCEAN;
  return null;
}

/**
 * Distinct glyphs for a theme, themed ones first with the neutral set appended
 * so a generator that needs many distinct shapes never runs short. Used where
 * the marks are just "objects" (counting, matching).
 */
export function themeGlyphs(theme: ThemeId): Glyph[] {
  const fam = themedFamily(theme);
  return fam ? [...fam, ...NEUTRAL.filter((g) => !fam.includes(g))] : NEUTRAL;
}

/**
 * A visual-search set: a target plus distractors. Themed themes get a family of
 * distinct themed objects (find every fish among the shells and drops); other
 * themes return null so the generator keeps its confusable near-miss families.
 */
export function themeSearchGlyphs(theme: ThemeId): Glyph[] | null {
  return themedFamily(theme);
}

/** Maze start/goal markers. */
export function themeMarkers(theme: ThemeId): { start: Glyph; goal: Glyph } {
  if (theme === "nature") return { start: leafGlyph, goal: sunGlyph };
  if (theme === "space") return { start: rocketGlyph, goal: planetGlyph };
  if (theme === "ocean") return { start: fishGlyph, goal: shellGlyph };
  return { start: circleGlyph, goal: starGlyph };
}
