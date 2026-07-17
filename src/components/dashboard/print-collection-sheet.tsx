"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sticker, Loader2 } from "lucide-react";
import { printWorksheetForChild } from "@/lib/worksheet-records/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * "Print collection sheet" (Sprint 7 M4) — a fresh reward_chart every click.
 * Reuses printWorksheetForChild: it persists a recipe with a fresh seed and
 * redirects to the print route, so each print is a new, unique sheet. Surfaces
 * on the dashboard child card and the session-summary screen.
 */
export function PrintCollectionSheet({ childId, className }: { childId: string; className?: string }) {
  const t = useTranslations("collectionSheet");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function run() {
    setError(false);
    startTransition(async () => {
      const result = await printWorksheetForChild("reward_chart", childId, locale);
      if (result?.error) setError(true);
    });
  }

  return (
    <div className={cn("w-full", className)}>
      <Button variant="outline" className="w-full gap-1.5" disabled={pending} onClick={run}>
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Sticker className="size-3.5" aria-hidden="true" />
        )}
        {pending ? t("preparing") : t("cta")}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{t("error")}</p>}
    </div>
  );
}
