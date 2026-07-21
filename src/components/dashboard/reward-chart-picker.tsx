"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sticker, Loader2, Shuffle } from "lucide-react";
import { printRewardChart } from "@/lib/worksheet-records/actions";
import type { RewardFamily } from "@/lib/worksheets/generators/reward-chart";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Reward-chart print chooser (Sprint 8 M3). The print button opens a small grid
 * of the five motifs (live thumbnails, server-rendered and passed in) plus a
 * "Meglepetés" random tile. Picking one prints that motif with a fresh seed.
 */
export function RewardChartPicker({
  childId,
  motifs,
  className,
}: {
  childId: string;
  motifs: Array<{ family: RewardFamily; svg: string }>;
  className?: string;
}) {
  const t = useTranslations("collectionSheet");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errorKey, setErrorKey] = useState<string | null>(null);

  function pick(family: RewardFamily | null) {
    setErrorKey(null);
    startTransition(async () => {
      const result = await printRewardChart(childId, family, locale);
      // Reward charts are quota-exempt, so the only expected failure is the
      // anti-abuse rate limit.
      if (result?.error) setErrorKey(result.error === "rate_limited" ? "rateLimited" : "error");
    });
  }

  if (!open) {
    return (
      <div className={cn("w-full", className)}>
        <Button variant="outline" className="w-full gap-1.5" onClick={() => setOpen(true)}>
          <Sticker className="size-3.5" aria-hidden="true" />
          {t("cta")}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-2 text-left", className)}>
      <p className="text-xs font-medium text-ink-soft">{t("pickTitle")}</p>
      <div className="grid grid-cols-3 gap-2">
        {motifs.map((m) => (
          <button
            key={m.family}
            type="button"
            disabled={pending}
            onClick={() => pick(m.family)}
            aria-label={t(`motif.${m.family}`)}
            className="aspect-square overflow-hidden rounded-lg border border-line bg-white p-1 transition-colors hover:border-crayon disabled:opacity-60 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: m.svg }}
          />
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={() => pick(null)}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-soft transition-colors hover:border-crayon hover:text-crayon-text disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Shuffle className="size-5" aria-hidden="true" />}
          <span className="text-[11px] font-medium">{t("surprise")}</span>
        </button>
      </div>
      {errorKey && <p className="text-xs text-destructive">{t(errorKey)}</p>}
    </div>
  );
}
