import { getTranslations } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { MATERIALS } from "@/lib/activities/material-list";
import type { MaterialId } from "@/lib/activities/engine";
import type { ThemeId } from "@/lib/worksheets/types";

/**
 * Session header meta (Sprint 7 M5a): the theme this plan wears and the
 * materials it was built to assume, as chips — so the parent's choices are
 * visible in the session, not silently swallowed by the composer.
 */
export async function SessionMeta({ theme, materials }: { theme: ThemeId; materials: MaterialId[] }) {
  const t = await getTranslations();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-crayon-soft px-2.5 py-1 text-xs font-medium text-crayon-text">
        <Sparkles className="size-3.5" aria-hidden="true" />
        {t(`themes.${theme}`)}
      </span>
      {materials.map((id) => {
        const Icon = MATERIALS.find((m) => m.id === id)?.icon;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full border border-line bg-card px-2 py-1 text-xs text-ink-soft"
          >
            {Icon && <Icon className="size-3.5" aria-hidden="true" />}
            {t(`materials.${id}`)}
          </span>
        );
      })}
    </div>
  );
}
