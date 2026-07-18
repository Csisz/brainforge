"use client";

import { useTranslations } from "next-intl";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Beta-mode replacement for any upgrade CTA when Stripe is not configured
 * (Sprint 7 M8). Paid plans are intentionally off during the beta, so instead of
 * a checkout button that dead-ends we say plainly that plans are coming and offer
 * a way to reach us. Rendered wherever a checkout would be — the caller decides
 * which mode to show from stripeConfigured(); this component never guesses.
 */
export function UpgradeNotice({ className }: { className?: string }) {
  const t = useTranslations("upgrade");
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm leading-snug text-ink-soft">{t("betaNotice")}</p>
      <a
        href="mailto:hello@kalmokids.com"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-crayon-text hover:underline"
      >
        <Mail className="size-3.5" aria-hidden="true" />
        {t("betaContact")}
      </a>
    </div>
  );
}
