"use client";

import { useEffect } from "react";
import { RefreshCw, Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * The warm, on-brand fallback a route error boundary shows when something in its
 * subtree throws. Deliberately NOT a stack trace: the boundary logs the real
 * error (Next also logs the original server-side); the parent only ever sees a
 * reassuring card and a working retry. Echoes the dashed-crayon motif of
 * UpgradeCard so it reads as part of the product, not a system page.
 */
export function ErrorState({
  reset,
  error,
  homeHref,
}: {
  reset: () => void;
  error?: Error & { digest?: string };
  /** When set, also offer a "back to dashboard" escape hatch (app segment only). */
  homeHref?: string;
}) {
  const t = useTranslations("errorBoundary");

  // Keep the failure visible in the console so a boundary never hides a real
  // bug — the user sees the friendly card, we still see what broke.
  useEffect(() => {
    if (error) console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-card border border-dashed border-crayon/50 bg-crayon-soft/40 px-6 py-12 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
        <Compass className="size-6" aria-hidden="true" />
      </span>
      <div className="space-y-1.5">
        <p className="font-display text-xl font-extrabold text-ink">{t("title")}</p>
        <p className="text-ink-soft">{t("body")}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset} size="lg" className="gap-1.5">
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("retry")}
        </Button>
        {homeHref && (
          <Button asChild variant="ghost" size="lg">
            <Link href={homeHref}>{t("back")}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
