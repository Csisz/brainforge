"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/actions";
import type { PurchasableTier } from "@/lib/stripe/config";
import { Button } from "@/components/ui/button";

/**
 * Plan controls. A free account is offered the two paid tiers; a paying account
 * gets the Stripe customer portal to manage or cancel. When Stripe is not
 * configured (local dev without keys), the actions return `billing_unavailable`
 * and we show a quiet note instead of dead buttons.
 */
export function BillingActions({ tier, configured }: { tier: string; configured: boolean }) {
  const t = useTranslations("billing");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!configured) return <p className="text-sm text-ink-soft">{t("unavailable")}</p>;

  const go = (run: () => Promise<{ url?: string; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await run();
      if (result.url) window.location.href = result.url;
      else setError(result.error ?? "error");
    });

  const isPaid = tier !== "free";

  return (
    <div className="space-y-2">
      {isPaid ? (
        <Button variant="outline" disabled={pending} onClick={() => go(() => createPortalSession())}>
          {t("manage")}
        </Button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => go(() => createCheckoutSession("premium" as PurchasableTier))}>
            {t("upgradePremium")}
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => go(() => createCheckoutSession("family" as PurchasableTier))}
          >
            {t("upgradeFamily")}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{t("error")}</p>}
    </div>
  );
}
