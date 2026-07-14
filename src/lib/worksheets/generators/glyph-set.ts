import { circle, path } from "../svg";

/**
 * SHARED LINE-ART GLYPH SET
 * -------------------------
 * A small alphabet of simple, instantly-recognizable shapes used by the
 * symbol-based worksheets (memory cards, logic grid, hidden objects, cut &
 * paste). Kept in one place so those generators draw from the same visual
 * world and a child sees consistent icons across sheet types.
 *
 * Each glyph draws inside a radius-r box around (cx, cy) and takes a style so
 * the same shape can render as an outline (default worksheet look) or a solid
 * silhouette. Line-only glyphs (sun, flower) are intended for outline use.
 */

export type Style = Record<string, string | number | undefined>;

export const outline = (w = 1.0): Style => ({
  fill: "none",
  stroke: "#111",
  "stroke-width": w,
  "stroke-linejoin": "round",
  "stroke-linecap": "round",
});
export const solid: Style = { fill: "#111", stroke: "none" };

export type Glyph = (cx: number, cy: number, r: number, st: Style) => string;

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

/** Named so the symbol alphabet is stable across versions (order = identity). */
export const GLYPHS: ReadonlyArray<{ name: string; draw: Glyph }> = [
  { name: "circle", draw: (x, y, r, st) => circle(x, y, r, st) },
  { name: "square", draw: (x, y, r, st) => path(`M ${x - r} ${y - r} h ${2 * r} v ${2 * r} h ${-2 * r} Z`, { ...st, rx: r * 0.16 }) },
  { name: "triangle", draw: (x, y, r, st) => path(`M ${x} ${y - r} L ${x + r} ${y + r * 0.85} L ${x - r} ${y + r * 0.85} Z`, st) },
  { name: "diamond", draw: (x, y, r, st) => path(`M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`, st) },
  { name: "star", draw: (x, y, r, st) => path(starD(x, y, r), st) },
  { name: "heart", draw: (x, y, r, st) => path(heartD(x, y, r), st) },
  { name: "house", draw: (x, y, r, st) => path(`M ${x - r} ${y + r * 0.7} L ${x - r} ${y - r * 0.25} L ${x} ${y - r} L ${x + r} ${y - r * 0.25} L ${x + r} ${y + r * 0.7} Z`, st) },
  { name: "moon", draw: (x, y, r, st) => path(crescentD(x, y, r), st) },
  {
    name: "flower",
    draw: (x, y, r, st) => {
      const petals: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        petals.push(circle(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.42, st));
      }
      return petals.join("") + circle(x, y, r * 0.34, st);
    },
  },
  {
    name: "sun",
    draw: (x, y, r, st) => {
      const rays: string[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        rays.push(path(`M ${x + Math.cos(a) * r * 0.7} ${y + Math.sin(a) * r * 0.7} L ${x + Math.cos(a) * r} ${y + Math.sin(a) * r}`, st));
      }
      return circle(x, y, r * 0.55, st) + rays.join("");
    },
  },
  {
    name: "cloud",
    draw: (x, y, r, st) =>
      path(
        `M ${x - r} ${y + r * 0.5} a ${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.15} ${-r * 0.95} a ${r * 0.55} ${r * 0.55} 0 0 1 ${r * 0.95} ${-r * 0.1} a ${r * 0.5} ${r * 0.5} 0 0 1 ${r * 0.9} ${r * 0.55} a ${r * 0.4} ${r * 0.4} 0 0 1 ${-r * 0.2} ${r * 0.5} Z`,
        st,
      ),
  },
  {
    name: "fish",
    draw: (x, y, r, st) =>
      path(`M ${x - r} ${y} C ${x - r * 0.5} ${y - r * 0.75}, ${x + r * 0.5} ${y - r * 0.75}, ${x + r * 0.6} ${y} C ${x + r * 0.5} ${y + r * 0.75}, ${x - r * 0.5} ${y + r * 0.75}, ${x - r} ${y} Z`, st) +
      path(`M ${x + r * 0.55} ${y} L ${x + r} ${y - r * 0.5} L ${x + r} ${y + r * 0.5} Z`, st),
  },
];

export const GLYPH_COUNT = GLYPHS.length;
