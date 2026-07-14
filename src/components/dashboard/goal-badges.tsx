"use client";

import { useTranslations } from "next-intl";
import type { DevelopmentGoal } from "@/lib/worksheets/types";
import { badgeVariants } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The three "try these next" goals on a child card. Each badge is a focusable
 * trigger (keyboard + touch reachable) whose tooltip explains the goal in plain
 * language via goalDescriptions.
 */
export function GoalBadges({ goals }: { goals: DevelopmentGoal[] }) {
  const tGoals = useTranslations("goals");
  const tDesc = useTranslations("goalDescriptions");

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-wrap justify-center gap-1.5">
        {goals.map((goal) => (
          <Tooltip key={goal}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(badgeVariants({ variant: "outline" }), "cursor-help border-line text-ink-soft")}
              >
                {tGoals(goal)}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-56 text-center">{tDesc(goal)}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
