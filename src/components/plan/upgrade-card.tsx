import { getTranslations, getFormatter } from "next-intl/server";
import { Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { UpgradeNotice } from "@/components/plan/upgrade-notice";
import { stripeConfigured } from "@/lib/stripe/config";

/**
 * Shown in place of a gated worksheet. No dark patterns: it states plainly that
 * the weekly free allowance is used up, and — the honest part — exactly when the
 * next free sheet unlocks, so upgrading is a choice, not the only way forward.
 */
export async function UpgradeCard({ unlockAt }: { unlockAt: Date | null }) {
  const t = await getTranslations("upgrade");
  const format = await getFormatter();

  return (
    <div className="rounded-card border border-dashed border-crayon/50 bg-crayon-soft/40 p-5 text-center">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-3 font-display text-base font-bold text-ink">{t("title")}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">{t("body")}</p>
      {unlockAt && (
        <p className="mt-2 text-sm text-ink">
          {t("unlockAt", { date: format.dateTime(unlockAt, { dateStyle: "medium", timeStyle: "short" }) })}
        </p>
      )}
      {/* Beta runs without Stripe: point to settings only when there is a real
          plan to buy; otherwise say plans are coming (Sprint 7 M8). */}
      {stripeConfigured() ? (
        <Button asChild className="mt-4">
          <Link href="/app/settings">{t("cta")}</Link>
        </Button>
      ) : (
        <UpgradeNotice className="mt-4 flex flex-col items-center" />
      )}
    </div>
  );
}
