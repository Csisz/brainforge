"use client";

import { useTranslations } from "next-intl";
import { ACHIEVEMENT_ICON, type AchievementKind } from "@/lib/achievements";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Earned achievement badges — line-art icons in a crayon-soft coin, each a
 * focusable trigger whose tooltip gives the localized name + playful blurb.
 * Renders nothing when the child has none yet.
 */
export function AchievementBadges({ kinds, size = "sm" }: { kinds: AchievementKind[]; size?: "sm" | "md" }) {
  const t = useTranslations("achievements");
  if (kinds.length === 0) return null;

  const coin = size === "md" ? "size-9" : "size-7";
  const glyph = size === "md" ? "size-4.5" : "size-3.5";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-wrap items-center gap-1.5">
        {kinds.map((kind) => {
          const Icon = ACHIEVEMENT_ICON[kind];
          return (
            <Tooltip key={kind}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex shrink-0 cursor-help items-center justify-center rounded-full border border-crayon/40 bg-crayon-soft text-crayon-text",
                    coin,
                  )}
                >
                  <Icon className={glyph} aria-hidden="true" />
                  <span className="sr-only">{t(`${kind}.name`)}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-56 text-center">
                <p className="font-semibold">{t(`${kind}.name`)}</p>
                <p className="text-xs text-ink-soft">{t(`${kind}.description`)}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
