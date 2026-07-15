import { getTranslations } from "next-intl/server";
import type { DevelopmentGoal, Difficulty } from "@/lib/worksheets/types";
import { cn } from "@/lib/utils";

/**
 * Where a child currently is on a goal: five dots, the first `level` filled.
 *
 * Framing rules, which are the whole point of this component:
 *  - Neutral ink only. Never green-for-high or red-for-low — a 2 is not a
 *    warning, it is where the good sheets are for this child today.
 *  - No arrows, no deltas, no history. A parent must not be able to read
 *    "went down" off this, because down is not bad and we will not imply it is.
 *  - Labelled "jelenlegi szint" (current level), never "teljesítmény"
 *    (performance). This measures the material, not the child.
 */
export async function LevelDots({
  goal,
  level,
  className,
}: {
  goal: DevelopmentGoal;
  level: Difficulty;
  className?: string;
}) {
  const t = await getTranslations();

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="text-xs text-ink-soft">{t(`goals.${goal}`)}</span>
      <span
        className="flex items-center gap-1"
        role="img"
        aria-label={`${t(`goals.${goal}`)} — ${t("adaptive.levelOf", { level })}`}
      >
        {[1, 2, 3, 4, 5].map((dot) => (
          <span
            key={dot}
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              // One neutral ink at two weights: present or not, not good or bad.
              dot <= level ? "bg-ink-soft" : "bg-line",
            )}
          />
        ))}
      </span>
    </div>
  );
}

/** The labelled group, as it appears on a child's page. */
export async function LevelPanel({
  levels,
  className,
}: {
  levels: Array<{ goal: DevelopmentGoal; level: Difficulty }>;
  className?: string;
}) {
  const t = await getTranslations();
  if (levels.length === 0) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs font-medium text-ink-soft">{t("adaptive.levelLabel")}</p>
      {levels.map(({ goal, level }) => (
        <LevelDots key={goal} goal={goal} level={level} />
      ))}
    </div>
  );
}
