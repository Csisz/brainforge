/**
 * Deterministic, seedable PRNG (sfc32).
 *
 * WHY THIS EXISTS
 * ---------------
 * Every worksheet in Kalmo Kids is identified by (generatorId, params, seed).
 * We never store rendered SVGs — we store the recipe and re-render on demand.
 * That only works if generation is fully deterministic: same seed, same
 * output, forever. Math.random() is therefore banned inside generators;
 * this module is the only source of randomness they may use.
 *
 * sfc32 is fast, passes PractRand, and is trivially portable — important if
 * we ever re-implement rendering in an Edge Function or another language.
 */

export type RNG = {
  /** Float in [0, 1) */
  next(): number;
  /** Integer in [min, max] inclusive */
  int(min: number, max: number): number;
  /** Pick a random element */
  pick<T>(arr: readonly T[]): T;
  /** Fisher–Yates shuffle (returns a new array) */
  shuffle<T>(arr: readonly T[]): T[];
  /** True with probability p */
  chance(p: number): boolean;
  /** Fork a child RNG with a label — keeps sub-systems independent */
  fork(label: string): RNG;
};

/** 128-bit-ish string hash → four 32-bit seeds (cyrb128) */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const out = (t + d) | 0;
    c = (c + out) | 0;
    return (out >>> 0) / 4294967296;
  };
}

export function createRng(seed: string): RNG {
  const [a, b, c, d] = cyrb128(seed);
  const next = sfc32(a, b, c, d);
  // Warm up — first few sfc32 outputs correlate with the seed
  for (let i = 0; i < 12; i++) next();

  const rng: RNG = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => {
      if (arr.length === 0) throw new Error("pick() on empty array");
      return arr[Math.floor(next() * arr.length)]!;
    },
    shuffle: (arr) => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    chance: (p) => next() < p,
    fork: (label) => createRng(`${seed}::${label}`),
  };
  return rng;
}

/** Generate a fresh random seed (uses crypto where available). */
export function freshSeed(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
