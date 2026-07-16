"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteAccount } from "@/lib/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Account deletion — a deliberately friction-ful "danger zone". The action is
 * disabled until the parent types their exact email, and the destructive button
 * is only shown after they open the confirm step. No accidental clicks.
 */
export function DeleteAccount({ email }: { email: string }) {
  const t = useTranslations("deleteAccount");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmed = typed.trim().toLowerCase() === email.toLowerCase();

  function run() {
    startTransition(async () => {
      setError(false);
      const result = await deleteAccount(typed);
      if (result.error) {
        setError(true);
        return;
      }
      router.push("/");
      router.refresh();
    });
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
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">{t("confirmLabel", { email })}</Label>
            <Input
              id="delete-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={email}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-destructive">{t("error")}</p>}
          <div className="flex gap-2">
            <Button variant="destructive" disabled={!confirmed || pending} onClick={run}>
              {pending ? t("deleting") : t("confirm")}
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
