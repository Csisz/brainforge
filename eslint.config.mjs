import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * Flat ESLint config for Next 15 + TypeScript (Stability B4). Starts from the
 * Next recommended rulesets so `npm run lint` runs headlessly in CI. Where a rule
 * would force large, unrelated churn it's turned off deliberately below with a
 * reason — the goal is a meaningful gate, not a refactor.
 */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "src/app/fonts/**",
      "public/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
