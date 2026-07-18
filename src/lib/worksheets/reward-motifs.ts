import { composeWorksheet, defaultRenderOptions } from "./page";
import { getGenerator } from "./registry";
import { REWARD_FAMILIES, type RewardFamily } from "./generators/reward-chart";

/**
 * Live thumbnails of every reward-chart motif (Sprint 8 M3), for the print
 * chooser. Fixed preview seeds so the thumbnails are stable across renders, and
 * a small n so the little previews stay legible. Pure + server-side (same
 * composer as the catalog); callers render the returned SVG strings.
 */
export function rewardChartMotifs(): Array<{ family: RewardFamily; svg: string }> {
  const version = getGenerator("reward_chart").version;
  const ctx = {
    age: 5 as const,
    difficulty: 3 as const,
    theme: "nature" as const,
    render: defaultRenderOptions("hu"),
  };
  return REWARD_FAMILIES.map((family) => {
    const { svg } = composeWorksheet(
      { generatorId: "reward_chart", generatorVersion: version, params: { n: 12, family }, seed: `preview-${family}` },
      ctx,
      {},
      { thumbnail: true },
    );
    return { family, svg };
  });
}
