import { circle, group, path } from "@/lib/worksheets/svg";

/**
 * ACTIVITY PICTOGRAMS — IKEA-style "how to play" step diagrams.
 *
 * Line-art stick-figure panels for the physical activities, drawn with the
 * same SVG builder as the worksheets so they live in one visual world,
 * print beautifully (daily plan stays screen-free) and cost nothing to
 * localize. Each pictogram is 1–3 square panels read left to right.
 *
 * Registry key = the activity key used in the session composer
 * (e.g. "movement.cross_crawl"), so the UI can do
 * getPictogram(slot.activityKey) with zero mapping tables.
 *
 * Panels are drawn in a 40×40 local coordinate box; composePictogram()
 * lays them out with arrows and returns a standalone SVG sized in mm.
 * TODO(Sprint 4): animated variants for the app (SMIL/CSS on the same
 * geometry) — print uses the static frames unchanged.
 */

const S = { fill: "none", stroke: "#1f2a24", "stroke-width": 1.4, "stroke-linecap": "round" as const, "stroke-linejoin": "round" as const };
const SOFT = { ...S, stroke: "#9aa79f", "stroke-width": 1.1 };

/* ---------- stick-figure parts (40×40 panel space) ---------- */

const head = (cx: number, cy: number, r = 3.2) => circle(cx, cy, r, S);

/** Standing figure; arms/legs given as [x,y] endpoints relative to hip/shoulder. */
function figure(opts: {
  hx: number; hy: number;              // head center
  torso?: [number, number];            // hip point (default straight down)
  arms?: Array<[number, number, number, number]>; // shoulder-relative elbow + hand
  legs?: Array<[number, number, number, number]>; // hip-relative knee + foot
}): string {
  const { hx, hy } = opts;
  const neckY = hy + 3.2;
  const hip = opts.torso ?? [hx, neckY + 9];
  const shoulder: [number, number] = [hx, neckY + 2];
  const out: string[] = [head(hx, hy), path(`M ${hx} ${neckY} L ${hip[0]} ${hip[1]}`, S)];
  for (const [ex, ey, wx, wy] of opts.arms ?? []) {
    out.push(path(`M ${shoulder[0]} ${shoulder[1]} L ${shoulder[0] + ex} ${shoulder[1] + ey} L ${shoulder[0] + wx} ${shoulder[1] + wy}`, S));
  }
  for (const [kx, ky, fx, fy] of opts.legs ?? []) {
    out.push(path(`M ${hip[0]} ${hip[1]} L ${hip[0] + kx} ${hip[1] + ky} L ${hip[0] + fx} ${hip[1] + fy}`, S));
  }
  return out.join("");
}

const motionArrow = (x1: number, y1: number, x2: number, y2: number) => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const h = 2.2;
  return path(
    `M ${x1} ${y1} L ${x2} ${y2} M ${x2 - h * Math.cos(a - 0.5)} ${y2 - h * Math.sin(a - 0.5)} L ${x2} ${y2} L ${x2 - h * Math.cos(a + 0.5)} ${y2 - h * Math.sin(a + 0.5)}`,
    { ...S, stroke: "#ff6b5e", "stroke-width": 1.2 },
  );
};

const cup = (cx: number, baseY: number, w = 7, h = 8) =>
  path(`M ${cx - w / 2} ${baseY} L ${cx - w / 2 + 1.2} ${baseY - h} L ${cx + w / 2 - 1.2} ${baseY - h} L ${cx + w / 2} ${baseY} Z`, S);

const sq = (x: number, y: number, w: number, h = w, style = S) => path(`M ${x} ${y} h ${w} v ${h} h ${-w} Z`, style);
const balloon = (cx: number, cy: number, r = 4) =>
  circle(cx, cy, r, S) + path(`M ${cx} ${cy + r} l -1.2 2 l 2.4 0 Z`, S);

/* ---------- pictogram definitions ---------- */

const PICTOGRAMS: Record<string, string[]> = {
  "movement.cross_crawl": [
    // P1: right elbow to raised left knee
    figure({
      hx: 20, hy: 7,
      arms: [[-6, 4, -1, 9], [6, 3, 9, 8]],           // left arm crosses down to knee
      legs: [[-4, -1, -1, 3], [3, 6, 3, 13]],          // left knee raised, right leg standing
    }) + motionArrow(26, 14, 17, 20),
    // P2: mirror
    figure({
      hx: 20, hy: 7,
      arms: [[6, 4, 1, 9], [-6, 3, -9, 8]],
      legs: [[4, -1, 1, 3], [-3, 6, -3, 13]],
    }) + motionArrow(14, 14, 23, 20),
  ],
  "memory.cup_shuffle": [
    // P1: ball goes under middle cup
    cup(10, 32) + cup(20, 32) + cup(30, 32) + circle(20, 18, 2.2, S) + motionArrow(20, 21, 20, 27),
    // P2: cups swap
    cup(10, 32) + cup(20, 32) + cup(30, 32) +
      path("M 12 18 C 15 12, 25 12, 28 18", { ...SOFT, "stroke-dasharray": "2 1.5" }) + motionArrow(27, 17.4, 28, 18.6) +
      path("M 28 22 C 25 27, 15 27, 12 22", { ...SOFT, "stroke-dasharray": "2 1.5" }) + motionArrow(13, 22.6, 12, 21.4),
    // P3: child points at a cup
    cup(10, 32) + cup(20, 32) + cup(30, 32) +
      path("M 30 12 L 22 24", S) + circle(31.5, 10.5, 1.6, S) + // pointing arm + fingertip hint
      path("M 17 8 L 19 8 M 18 7 L 18 9", { ...SOFT }), // small sparkle "?"
  ],
  "movement.ball_target": [
    // P1: throw — figure, ball leaving hand, arc to basket
    figure({ hx: 9, hy: 8, arms: [[5, -2, 9, -5], [-4, 4, -5, 9]], legs: [[-2, 6, -2, 13], [3, 6, 4, 13]] }) +
      circle(20, 6, 2, S) +
      path("M 22 6 C 28 4, 33 10, 34 16", { ...SOFT, "stroke-dasharray": "2 1.5" }) +
      path("M 30 20 L 30 26 L 38 26 L 38 20", S), // basket
    // P2: hit + step back
    path("M 30 20 L 30 26 L 38 26 L 38 20", S) + circle(34, 23.5, 2, S) +
      figure({ hx: 9, hy: 10, arms: [[-4, 4, -4, 9], [4, 4, 4, 9]], legs: [[-2, 6, -2, 13], [3, 6, 4, 13]] }) +
      motionArrow(12, 32, 4, 32),
  ],
  "movement.animal_walks": [
    // P1: bear walk — all fours, knees off ground
    head(8, 16, 3) +
      path("M 11 18 C 17 14, 25 14, 31 18", S) +           // back
      path("M 13 19 L 12 26 L 12 30 M 29 19 L 30 26 L 30 30", S) + // front+back limbs
      path("M 18 18 L 17 25 L 17 29 M 24 18 L 25 25 L 25 29", SOFT) +
      motionArrow(33, 24, 39, 24),
    // P2: frog jump — crouch then arc
    figure({ hx: 10, hy: 20, torso: [10, 28], arms: [[-3, 5, -3, 8], [3, 5, 3, 8]], legs: [[-4, 1, -2, 5], [4, 1, 2, 5]] }) +
      path("M 14 24 C 20 12, 28 12, 34 24", { ...SOFT, "stroke-dasharray": "2 1.5" }) + motionArrow(33, 22, 34.5, 24.5),
  ],
  "warmup.finger_gym": [
    // P1: open hand
    path("M 14 34 L 14 20 M 14 22 C 12 16, 13 12, 15 12 M 17 20 L 17 10 M 20 20 L 20 9 M 23 20 L 23 10 M 26 22 L 26 13", S) +
      path("M 14 34 C 14 28, 26 28, 26 34 M 26 22 L 26 28", S),
    // P2: thumb touches index fingertip
    path("M 14 34 L 14 22 M 17 20 L 17 10 M 20 20 L 20 9 M 23 20 L 23 10 M 26 22 L 26 13", S) +
      path("M 14 34 C 14 28, 26 28, 26 34 M 26 22 L 26 28", S) +
      path("M 14 22 C 13 16, 15 11, 17 10", S) + circle(17, 10, 1.6, { fill: "none", stroke: "#ff6b5e", "stroke-width": 0.9 }),
  ],
  "movement.hopscotch": [
    // hopscotch grid (1 / 2-3 / 4) and a figure hopping on one foot toward it
    sq(16, 30, 8) + sq(11, 22, 8) + sq(19, 22, 8) + sq(16, 14, 8) +
      figure({ hx: 6, hy: 9, arms: [[-3, 2, -5, 5], [3, 2, 5, 4]], legs: [[-1, 6, -1, 12], [2, 3, 4, 4]] }) +
      motionArrow(9, 18, 15, 12),
  ],
  "movement.bean_bag_balance": [
    // walk across the room with a small soft object balanced on the head
    figure({ hx: 20, hy: 13, arms: [[-6, 1, -9, 3], [6, 1, 9, 3]], legs: [[-3, 6, -3, 12], [3, 6, 5, 12]] }) +
      sq(16, 5, 8, 3) +
      motionArrow(28, 30, 36, 30),
  ],
  "movement.balloon_keep_up": [
    // tap a balloon upward to keep it off the floor
    figure({ hx: 14, hy: 18, arms: [[3, -7, 7, -11], [-4, 4, -5, 9]], legs: [[-2, 6, -2, 12], [3, 6, 4, 12]] }) +
      balloon(26, 7) + motionArrow(24, 11, 22, 6),
  ],
  "movement.freeze_dance": [
    // P1: dancing to a beat
    figure({ hx: 16, hy: 11, arms: [[-5, -3, -8, -7], [5, 3, 8, 6]], legs: [[-3, 5, -6, 11], [3, 6, 4, 12]] }) +
      circle(31, 8, 1, { ...S, stroke: "#ff6b5e" }) + path("M 32 8 L 32 3 L 35 4", { ...S, stroke: "#ff6b5e", "stroke-width": 1.1 }),
    // P2: freeze like a statue when the beat stops
    figure({ hx: 20, hy: 11, arms: [[-5, 0, -8, 0], [5, 0, 8, 0]], legs: [[-2, 6, -2, 12], [2, 6, 2, 12]] }) +
      path("M 11 5 L 29 5", SOFT) + path("M 14 3 L 14 7 M 26 3 L 26 7", SOFT),
  ],
  "memory.copy_the_tower": [
    // P1: study the model tower
    sq(8, 26, 9) + sq(8, 17, 9) + sq(8, 8, 9) +
      path("M 24 15 C 27 12, 33 12, 36 15 C 33 18, 27 18, 24 15 Z", S) + circle(30, 15, 1.6, S),
    // P2: rebuild it from memory (top block being placed)
    sq(20, 26, 9) + sq(20, 17, 9) + sq(20, 8, 9, 9, SOFT) +
      circle(24.5, 3, 2, S) + path("M 24.5 5 L 24.5 8", S) + motionArrow(24.5, 5.5, 24.5, 8),
  ],
  "memory.touch_and_tell": [
    // reach into a feely bag and name what you touch
    path("M 11 16 C 13 12, 27 12, 29 16 L 31 33 C 31 36, 9 36, 9 33 Z", S) +
      path("M 13 15 C 15 12, 25 12, 27 15", SOFT) +
      path("M 20 4 L 20 14", S) + circle(20, 4, 2, S) +
      path("M 33 21 c 3 -3 5 1 1 3", SOFT) + circle(34, 26, 0.6, SOFT),
  ],
};

/* ---------- composition ---------- */

export function hasPictogram(activityKey: string): boolean {
  return activityKey.replace(/^activity\./, "") in PICTOGRAMS;
}

/**
 * Standalone SVG strip for an activity, sized in mm. Returns null when no
 * pictogram exists (UI simply shows text-only in that case).
 */
export function composePictogram(activityKey: string, opts: { panelMm?: number } = {}): string | null {
  const key = activityKey.replace(/^activity\./, "");
  const panels = PICTOGRAMS[key];
  if (!panels) return null;
  const p = opts.panelMm ?? 26;
  const gap = 7;
  const w = panels.length * p + (panels.length - 1) * gap;
  const scale = p / 40;

  const content = panels
    .map((body, i) => {
      const x = i * (p + gap);
      const frame = path(`M ${x + 0.4} 0.4 h ${p - 0.8} v ${p - 0.8} h ${-(p - 0.8)} Z`, { fill: "none", stroke: "#e8e8e3", "stroke-width": 0.5, rx: 2 });
      const step = i < panels.length - 1
        ? path(`M ${x + p + 1.5} ${p / 2} L ${x + p + gap - 1.5} ${p / 2} M ${x + p + gap - 3} ${p / 2 - 1.4} L ${x + p + gap - 1.5} ${p / 2} L ${x + p + gap - 3} ${p / 2 + 1.4}`, {
            fill: "none", stroke: "#9aa79f", "stroke-width": 0.7, "stroke-linecap": "round",
          })
        : "";
      return frame + group({ transform: `translate(${x} 0) scale(${scale.toFixed(4)})` }, body) + step;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${p}mm" viewBox="0 0 ${w} ${p}">${content}</svg>`;
}

export function pictogramKeys(): string[] {
  return Object.keys(PICTOGRAMS);
}
