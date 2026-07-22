"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/actions";
import type { PurchasableTier } from "@/lib/stripe/config";
import { Button } from "@/components/ui/button";
import { UpgradeNotice } from "@/components/plan/upgrade-notice";

/**
 * Plan controls. A free account is offered the two paid tiers; a paying account
 * gets the Stripe customer portal to manage or cancel. When Stripe is not
 * configured (the beta runs without it), we show the beta notice instead of dead
 * checkout buttons (Sprint 7 M8).
 */
export function BillingActions({ tier, configured }: { tier: string; configured: boolean }) {
  const t = useTranslations("billing");
  const tCommon = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!configured) return <UpgradeNotice />;

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
      {error && (
        <p className="text-sm text-destructive">
          {error === "invalid_input" ? tCommon("invalidInput") : t("error")}
        </p>
      )}
    </div>
  );
}
