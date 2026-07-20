/**
 * Ease → success-rate mapping. Lives in its own module (NOT the "use server"
 * actions file): a "use server" file may export only async functions, so the
 * EASE_SUCCESS object — imported by the feedback action, the session view and the
 * flow test — must sit outside it, or the whole action module fails to load at
 * runtime and the session save 503s.
 *
 * How the sheet went, in the parent's words. We never ask a parent to score
 * their child out of 100 — they pick one of three honest descriptions and we
 * map it to the success signal the calibration engine needs.
 */
export type Ease = "easy" | "ok" | "hard";

export const EASE_SUCCESS: Record<Ease, number> = {
  easy: 1,
  ok: 0.65,
  hard: 0.3,
};
