import type { ThemeId } from "./types";

/**
 * Runtime enumeration of ThemeId, kept alongside (not inside) the locked
 * types.ts contract — used anywhere the UI needs to iterate the closed union
 * (onboarding theme picker, session wizard).
 */
export const THEME_IDS: readonly ThemeId[] = [
  "dinosaurs",
  "princesses",
  "space",
  "ocean",
  "farm",
  "cars",
  "robots",
  "unicorns",
  "nature",
  "magic",
  "blocks",
  "custom",
];
