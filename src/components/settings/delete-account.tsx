"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MailCheck } from "lucide-react";
import { requestAccountDeletion } from "@/lib/account/actions";
import { Button } from "@/components/ui/button";

/**
 * Account deletion — step 1 of a two-step, email-confirmed flow (Sprint 7 M7b).
 * This danger zone no longer deletes: it emails a confirmation link that lands on
 * an in-app page where the parent re-types their email to finish. So a single
 * click here (or a hijacked session) can never erase an account. In environments
 * without app email (local dev), the returned link is shown directly.
 */
export function DeleteAccount({ email }: { email: string }) {
  const t = useTranslations("deleteAccount");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<{ url?: string; emailed?: boolean } | null>(null);
  const [error, setError] = useState(false);

  function send() {
    startTransition(async () => {
      setError(false);
      const result = await requestAccountDeletion(locale);
      if (result.error) {
        setError(true);
        return;
      }
      setSent({ url: result.url, emailed: result.emailed });
    });
  }

  if (sent) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-card border border-line bg-mist/60 p-4">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-crayon-text" aria-hidden="true" />
          <p className="text-sm leading-snug text-ink-soft">{t("sent", { email })}</p>
        </div>
        {!sent.emailed && sent.url && (
          <div className="rounded-card border border-line p-3">
            <p className="text-sm text-ink-soft">{t("devLinkNote")}</p>
            <a
              href={sent.url}
              className="mt-1 inline-block text-sm font-medium text-crayon-text underline"
            >
              {t("devLinkCta")}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-snug text-ink-soft">{t("description")}</p>
      {!open ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          {t("open")}
        </Button>
      ) : (
        <div className="space-y-3 rounded-card border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm leading-snug text-ink-soft">{t("requestIntro", { email })}</p>
          {error && <p className="text-sm text-destructive">{t("requestError")}</p>}
          <div className="flex gap-2">
            <Button variant="destructive" disabled={pending} onClick={send}>
              {pending ? t("sending") : t("sendLink")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
