import type { WorksheetGenerator, WorksheetContent, GeneratorContext } from "../types";
import type { RNG } from "@/lib/random";
import { circle, path, line, group } from "../svg";

/**
 * REWARD COLLECTION SHEET (Sprint 7 M4) — not a trained task, a keepsake.
 *
 * A full-page sheet of N clearly-bounded shapes; the child shades one, or adds
 * a sticker, for every finished task or day (default 21 ≈ a week with margin).
 * Five seeded motifs — a tree filling with leaves, a flower's petals, a bunch of
 * balloons, a fish growing scales, a caterpillar's segments — so no two prints
 * look alike. Outlines only (lowInk-friendly): every shape is empty on purpose,
 * waiting to be filled in. Elements stay ≥18mm so a small sticker or a crayon
 * fits.
 *
 * This generator lives OUTSIDE the goal-based engine: `goals: []` and
 * `catalogOnly` keep it out of `findGenerators`, so the composer never picks it.
 * It is in the registry only for the catalog and the print pipeline. The child's
 * name, the title and the date come from the page header (composeWorksheet), so
 * the content here is pure motif.
 */

export const REWARD_FAMILIES = ["tree", "flower", "balloon", "fish", "caterpillar"] as const;
export type RewardFamily = (typeof REWARD_FAMILIES)[number];

export type RewardChartParams = {
  /** Collectible count. Default 21 ≈ a week of tasks with margin. */
  n: number;
  family: RewardFamily;
};

// Content box in mm — sized close to the printable area below the header so the
// composer scales it ~1:1 and the shapes come out at their authored size.
const W = 178;
const H = 228;
const INK = "#141414";

type Style = Record<string, string | number>;

function lineStyle(ctx: GeneratorContext, weight = 1): Style {
  const scale = ctx.render.motorSupport ? 1.5 : 1;
  return {
    fill: "none",
    stroke: INK,
    "stroke-width": +(weight * scale).toFixed(2),
    "stroke-linejoin": "round",
    "stroke-linecap": "round",
  };
}
const FILLED: Style = { fill: INK, stroke: "none" };

const pt = (cx: number, cy: number, r: number, a: number): [number, number] => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const f = (n: number) => n.toFixed(2);

// ── tree: a trunk with N leaf outlines packed into a rounded canopy ──────────
function tree(n: number, rng: RNG, s: Style): string {
  const parts: string[] = [];
  const cxc = W / 2;
  const canopyCy = 96;
  const canopyRx = 84;
  const canopyRy = 80;

  // a short, tapered trunk rising into the bottom of the canopy
  const groundY = H - 6;
  const trunkTop = canopyCy + canopyRy * 0.55;
  const tw = 13;
  parts.push(
    path(
      `M ${f(cxc - tw)} ${f(groundY)} C ${f(cxc - tw * 0.6)} ${f(groundY - 30)} ${f(cxc - tw * 0.45)} ${f(trunkTop + 14)} ${f(cxc - tw * 0.4)} ${f(trunkTop)} L ${f(cxc + tw * 0.4)} ${f(trunkTop)} C ${f(cxc + tw * 0.45)} ${f(trunkTop + 14)} ${f(cxc + tw * 0.6)} ${f(groundY - 30)} ${f(cxc + tw)} ${f(groundY)} Z`,
      s,
    ),
  );
  parts.push(line(cxc - 24, groundY, cxc + 24, groundY, s));

  // a few branches fanning from the trunk up into the canopy, so leaves read as
  // hanging on a tree rather than floating
  const branchEnds: Array<[number, number]> = [
    [cxc - canopyRx * 0.5, canopyCy - canopyRy * 0.15],
    [cxc, canopyCy - canopyRy * 0.55],
    [cxc + canopyRx * 0.5, canopyCy - canopyRy * 0.1],
    [cxc - canopyRx * 0.25, canopyCy - canopyRy * 0.4],
    [cxc + canopyRx * 0.28, canopyCy - canopyRy * 0.45],
  ];
  for (const [bx, by] of rng.shuffle(branchEnds).slice(0, 3)) {
    const midX = (cxc + bx) / 2 + rng.int(-6, 6);
    parts.push(path(`M ${f(cxc)} ${f(trunkTop + 4)} Q ${f(midX)} ${f((trunkTop + by) / 2)} ${f(bx)} ${f(by)}`, s));
  }

  // pack candidate leaf slots on a jittered grid, keep those inside the canopy
  const step = 18;
  const slots: Array<[number, number]> = [];
  for (let y = canopyCy - canopyRy; y <= canopyCy + canopyRy * 0.78; y += step) {
    for (let x = cxc - canopyRx; x <= cxc + canopyRx; x += step) {
      const nx = (x - cxc) / canopyRx;
      const ny = (y - canopyCy) / canopyRy;
      if (nx * nx + ny * ny <= 0.95) slots.push([x + rng.int(-3, 3), y + rng.int(-3, 3)]);
    }
  }
  const chosen = rng.shuffle(slots).slice(0, n);
  // if the canopy could not host n leaves, spiral the rest outward (rare, big n)
  while (chosen.length < n) {
    const a = chosen.length * 2.4;
    const r = 12 + chosen.length * 2;
    chosen.push([cxc + r * Math.cos(a), canopyCy + r * Math.sin(a) * 0.9]);
  }
  for (const [x, y] of chosen) parts.push(leaf(x, y, 10, rng.next() * Math.PI, s));
  return parts.join("");
}

function leaf(cx: number, cy: number, r: number, rot: number, s: Style): string {
  const dx = Math.cos(rot) * r;
  const dy = Math.sin(rot) * r;
  const px = -Math.sin(rot) * r * 0.6;
  const py = Math.cos(rot) * r * 0.6;
  const tipA: [number, number] = [cx + dx, cy + dy];
  const tipB: [number, number] = [cx - dx, cy - dy];
  const midA: [number, number] = [cx + px, cy + py];
  const midB: [number, number] = [cx - px, cy - py];
  return (
    path(
      `M ${f(tipB[0])} ${f(tipB[1])} Q ${f(midA[0])} ${f(midA[1])} ${f(tipA[0])} ${f(tipA[1])} Q ${f(midB[0])} ${f(midB[1])} ${f(tipB[0])} ${f(tipB[1])} Z`,
      s,
    ) + line(tipA[0], tipA[1], tipB[0], tipB[1], { ...s, "stroke-width": (s["stroke-width"] as number) * 0.7 })
  );
}

// ── flower: a big disc with N petals radiating around it, on a stem ──────────
function flower(n: number, rng: RNG, s: Style): string {
  const parts: string[] = [];
  const cx = W / 2;
  const cy = 86;
  const discR = Math.max(30, Math.min(46, 150 / n + 34));
  const tipR = discR + 34;
  const phase = rng.next() * Math.PI * 2;
  const hw = (Math.PI / n) * 0.82;

  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const bl = pt(cx, cy, discR - 1, a - hw);
    const br = pt(cx, cy, discR - 1, a + hw);
    const tip = pt(cx, cy, tipR, a);
    const bulgeL = pt(cx, cy, (discR + tipR) / 2, a - hw * 1.5);
    const bulgeR = pt(cx, cy, (discR + tipR) / 2, a + hw * 1.5);
    parts.push(
      path(
        `M ${f(bl[0])} ${f(bl[1])} Q ${f(bulgeL[0])} ${f(bulgeL[1])} ${f(tip[0])} ${f(tip[1])} Q ${f(bulgeR[0])} ${f(bulgeR[1])} ${f(br[0])} ${f(br[1])} Z`,
        s,
      ),
    );
  }
  parts.push(circle(cx, cy, discR, s));
  // sunflower seed texture (phyllotaxis) — decorative, not collectible
  const seeds = 46;
  for (let i = 0; i < seeds; i++) {
    const rr = discR * 0.86 * Math.sqrt(i / seeds);
    const a = i * 2.399963;
    parts.push(circle(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 0.7, FILLED));
  }
  // stem + two leaves down to the base
  const stemBottom = H - 8;
  const sway = rng.int(-10, 10);
  parts.push(path(`M ${f(cx)} ${f(cy + discR)} Q ${f(cx + sway)} ${f((cy + discR + stemBottom) / 2)} ${f(cx)} ${f(stemBottom)}`, { ...s, "stroke-width": (s["stroke-width"] as number) * 1.3 }));
  const ly = (cy + discR + stemBottom) / 2;
  parts.push(leaf(cx - 16, ly - 6, 12, -0.5, s));
  parts.push(leaf(cx + 16, ly + 12, 12, 0.5, s));
  return parts.join("");
}

// ── balloon bunch: N balloons on strings gathered at the bottom ──────────────
function balloons(n: number, rng: RNG, s: Style): string {
  const parts: string[] = [];
  const bw = 22;
  const bh = 27;
  const cols = Math.ceil(Math.sqrt(n * 1.35));
  const rows = Math.ceil(n / cols);
  const gapX = (W - 12) / cols;
  const gapY = 30;
  const topY = 22;
  const gather: [number, number] = [W / 2, H - 12];

  let idx = 0;
  const placed: Array<[number, number]> = [];
  for (let r = 0; r < rows && idx < n; r++) {
    const count = Math.min(cols, n - idx);
    const offset = (r % 2) * (gapX / 2) + (W - count * gapX) / 2 + gapX / 2;
    for (let c = 0; c < count; c++, idx++) {
      const cx = offset + c * gapX + rng.int(-3, 3);
      const cy = topY + r * gapY + rng.int(-2, 2);
      placed.push([cx, cy]);
    }
  }
  // strings first, so balloons sit on top of the knots
  for (const [cx, cy] of placed) {
    const kx = cx;
    const ky = cy + bh / 2;
    const midX = (kx + gather[0]) / 2 + rng.int(-6, 6);
    parts.push(path(`M ${f(kx)} ${f(ky)} Q ${f(midX)} ${f((ky + gather[1]) / 2)} ${f(gather[0])} ${f(gather[1])}`, { ...s, "stroke-width": (s["stroke-width"] as number) * 0.6 }));
  }
  for (const [cx, cy] of placed) {
    parts.push(ellipse(cx, cy, bw / 2, bh / 2, s));
    parts.push(path(`M ${f(cx - 2)} ${f(cy + bh / 2)} L ${f(cx)} ${f(cy + bh / 2 + 3)} L ${f(cx + 2)} ${f(cy + bh / 2)} Z`, s));
  }
  return parts.join("");
}

function ellipse(cx: number, cy: number, rx: number, ry: number, s: Style): string {
  return `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" ${styleAttrs(s)}/>`;
}
function styleAttrs(s: Style): string {
  return Object.entries(s)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
}

// ── fish: a body outline filled with N scale scallops, tail + eye, in water ──
function fish(n: number, rng: RNG, s: Style): string {
  const parts: string[] = [];
  const cx = 100;
  const cy = 120;
  const bodyRx = 76;
  const bodyRy = 58;
  const thin: Style = { ...s, "stroke-width": (s["stroke-width"] as number) * 0.8 };

  // body (almond), tail fin on the left, mouth + eye on the right
  parts.push(
    path(
      `M ${f(cx - bodyRx)} ${f(cy)} C ${f(cx - bodyRx)} ${f(cy - bodyRy)} ${f(cx + bodyRx)} ${f(cy - bodyRy)} ${f(cx + bodyRx)} ${f(cy)} C ${f(cx + bodyRx)} ${f(cy + bodyRy)} ${f(cx - bodyRx)} ${f(cy + bodyRy)} ${f(cx - bodyRx)} ${f(cy)} Z`,
      s,
    ),
  );
  const tail = cx - bodyRx;
  parts.push(path(`M ${f(tail)} ${f(cy)} L ${f(tail - 24)} ${f(cy - 24)} L ${f(tail - 14)} ${f(cy)} L ${f(tail - 24)} ${f(cy + 24)} Z`, s));
  parts.push(circle(cx + bodyRx * 0.6, cy - bodyRy * 0.32, 3, s));
  parts.push(circle(cx + bodyRx * 0.6, cy - bodyRy * 0.32, 1.2, FILLED));
  parts.push(path(`M ${f(cx + bodyRx * 0.82)} ${f(cy + 3)} Q ${f(cx + bodyRx * 0.96)} ${f(cy + 7)} ${f(cx + bodyRx * 0.82)} ${f(cy + 11)}`, s));

  // N round scales on an offset grid, kept inside the body ellipse. Closed
  // circles (≥18mm) so each is a shape a child can clearly shade or sticker.
  const scaleR = 9;
  const stepX = 20;
  const stepY = 18;
  const slots: Array<[number, number]> = [];
  for (let row = 0; ; row++) {
    const y = cy - bodyRy + 15 + row * stepY;
    if (y > cy + bodyRy - 13) break;
    const off = (row % 2) * (stepX / 2);
    for (let x = cx - bodyRx + 16 + off; x <= cx + bodyRx - 14; x += stepX) {
      const nx = (x - cx) / (bodyRx - scaleR - 2);
      const ny = (y - cy) / (bodyRy - scaleR - 2);
      if (nx * nx + ny * ny <= 0.95) slots.push([x, y]);
    }
    if (slots.length > n * 4) break;
  }
  const chosen = rng.shuffle(slots).slice(0, n);
  for (const [x, y] of chosen) parts.push(circle(x, y, scaleR, s));

  // bubbles rising from the mouth toward the top, and a water surface at the
  // bottom — decorative, they carry the fish up and down a portrait sheet.
  const bx0 = cx + bodyRx * 0.9;
  ([[bx0 + 3, cy - 8, 2.2], [bx0 + 8, cy - 34, 3], [bx0 + 1, cy - 62, 4], [bx0 + 10, cy - 90, 5], [bx0 + 3, cy - 110, 3]] as const).forEach(
    ([bxRaw, byRaw, br]) => parts.push(circle(Math.min(bxRaw, W - 8), Math.max(byRaw, 10), br, thin)),
  );
  const waveY = cy + bodyRy + 36;
  let wave = `M 8 ${f(waveY)}`;
  for (let x = 8; x < W - 12; x += 18) wave += " q 9 -6 18 0";
  parts.push(path(wave, thin));
  return parts.join("");
}

// ── caterpillar: N segments snaking down the page on a connecting spine ──────
function caterpillar(n: number, rng: RNG, s: Style): string {
  const parts: string[] = [];
  const d = 25;
  const r = d / 2;
  const marginX = 16;
  const usableW = W - marginX * 2;
  const stepX = d * 0.82;
  const perRow = Math.max(4, Math.floor((usableW - d) / stepX) + 1);
  const rows = Math.ceil(n / perRow);
  const marginY = 20;
  const rowGap = rows > 1 ? Math.min(d * 1.15, (H - 2 * marginY - d) / (rows - 1)) : 0;
  const topY = (H - ((rows - 1) * rowGap + d)) / 2 + r;

  const centers: Array<[number, number]> = [];
  let idx = 0;
  for (let row = 0; row < rows && idx < n; row++) {
    const ltr = row % 2 === 0;
    const cy = topY + row * rowGap;
    const count = Math.min(perRow, n - idx);
    const rowW = (count - 1) * stepX;
    const startX = marginX + r + (usableW - d - rowW) / 2;
    for (let c = 0; c < count; c++, idx++) {
      const col = ltr ? c : count - 1 - c;
      centers.push([startX + col * stepX + rng.int(-1, 1), cy + rng.int(-1, 1)]);
    }
  }
  // spine through all centers so the segments read as one caterpillar
  parts.push(path(smooth(centers), { ...s, "stroke-width": (s["stroke-width"] as number) * 1.4 }));
  centers.forEach(([cx, cy]) => parts.push(circle(cx, cy, r, { ...s, fill: "#fff" })));

  // face on the first segment (the head)
  const [hx, hy] = centers[0]!;
  parts.push(circle(hx - r * 0.32, hy - r * 0.18, 1.4, FILLED));
  parts.push(circle(hx + r * 0.32, hy - r * 0.18, 1.4, FILLED));
  parts.push(path(`M ${f(hx - r * 0.35)} ${f(hy + r * 0.3)} Q ${f(hx)} ${f(hy + r * 0.55)} ${f(hx + r * 0.35)} ${f(hy + r * 0.3)}`, s));
  parts.push(line(hx - r * 0.35, hy - r * 0.75, hx - r * 0.6, hy - r * 1.2, s));
  parts.push(circle(hx - r * 0.6, hy - r * 1.3, 1.6, s));
  parts.push(line(hx + r * 0.35, hy - r * 0.75, hx + r * 0.6, hy - r * 1.2, s));
  parts.push(circle(hx + r * 0.6, hy - r * 1.3, 1.6, s));
  return parts.join("");
}

function smooth(pts: Array<[number, number]>): string {
  if (pts.length < 2) return "";
  let d = `M ${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

const FAMILY_FN: Record<RewardFamily, (n: number, rng: RNG, s: Style) => string> = {
  tree,
  flower,
  balloon: balloons,
  fish,
  caterpillar,
};

export const rewardChartGenerator: WorksheetGenerator<RewardChartParams> = {
  id: "reward_chart",
  version: 1,
  goals: [],
  catalogOnly: true,
  ageRange: [2, 10],

  defaultParams(ctx): RewardChartParams {
    return { n: 21, family: ctx.rng.pick(REWARD_FAMILIES) };
  },

  generate(ctx, params): WorksheetContent {
    const n = Math.max(6, Math.min(40, Math.round(params.n)));
    const s = lineStyle(ctx);
    const body = FAMILY_FN[params.family](n, ctx.rng.fork(`reward:${params.family}`), s);
    return {
      body: group({}, body),
      width: W,
      height: H,
      instructionKey: "worksheet.reward_chart.instruction",
    };
  },
};
