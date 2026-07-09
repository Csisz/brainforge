/**
 * Tiny SVG builder. No dependency — generators emit strings through these
 * helpers so escaping and number formatting stay consistent, and so we can
 * later swap the backend (e.g. to a streaming writer) without touching
 * generator logic. All coordinates are millimetres; the page composer sets
 * up the mm coordinate system.
 */

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function attrs(a: Record<string, string | number | undefined>): string {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${typeof v === "number" ? fmt(v) : esc(String(v))}"`)
    .join(" ");
}

export const el = (tag: string, a: Record<string, string | number | undefined>, children = ""): string =>
  children ? `<${tag} ${attrs(a)}>${children}</${tag}>` : `<${tag} ${attrs(a)}/>`;

export const line = (x1: number, y1: number, x2: number, y2: number, a: Record<string, string | number | undefined> = {}) =>
  el("line", { x1, y1, x2, y2, ...a });

export const circle = (cx: number, cy: number, r: number, a: Record<string, string | number | undefined> = {}) =>
  el("circle", { cx, cy, r, ...a });

export const rect = (x: number, y: number, w: number, h: number, a: Record<string, string | number | undefined> = {}) =>
  el("rect", { x, y, width: w, height: h, ...a });

export const path = (d: string, a: Record<string, string | number | undefined> = {}) => el("path", { d, ...a });

export const text = (x: number, y: number, content: string, a: Record<string, string | number | undefined> = {}) =>
  el("text", { x, y, ...a }, esc(content));

export const group = (a: Record<string, string | number | undefined>, children: string) => el("g", a, children);

/** Build a smooth path through points using Catmull-Rom → cubic Bézier. */
export function smoothPath(pts: Array<[number, number]>, closed = false): string {
  if (pts.length < 2) return "";
  const p = closed ? [...pts, pts[0]!, pts[1]!] : pts;
  let d = `M ${fmt(p[0]![0])} ${fmt(p[0]![1])}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(0, i - 1)]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[Math.min(p.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${fmt(c1x)} ${fmt(c1y)}, ${fmt(c2x)} ${fmt(c2y)}, ${fmt(p2[0])} ${fmt(p2[1])}`;
  }
  return d;
}
