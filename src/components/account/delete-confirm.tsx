"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteAccount } from "@/lib/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The final, deliberate step of account deletion (Sprint 7 M7b): on the
 * confirmation PAGE the email link lands on, the parent re-types their email and
 * clicks the red button. Only this action erases anything — the page render
 * (a bare GET on the link) never does. Deletion is gated server-side on BOTH the
 * signed token from the email and the typed email.
 */
export function DeleteConfirm({ email, token }: { email: string; token: string }) {
  const t = useTranslations("deleteAccount");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [error, setError] = useState(false);
  const [invalidInput, setInvalidInput] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmed = typed.trim().toLowerCase() === email.toLowerCase();

  function run() {
    startTransition(async () => {
      setError(false);
      setInvalidInput(false);
      const result = await deleteAccount(typed, token);
      if (result.error === "invalid_input") {
        setInvalidInput(true);
        return;
      }
      if (result.error) {
        setError(true);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-card border border-destructive/40 bg-destructive/5 p-4">
      <div className="space-y-1.5">
        <Label htmlFor="account-delete-confirm">{t("confirmLabel", { email })}</Label>
        <Input
          id="account-delete-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={email}
          autoComplete="off"
        />
      </div>
      {invalidInput && <p className="text-sm text-destructive">{tCommon("invalidInput")}</p>}
      {error && <p className="text-sm text-destructive">{t("error")}</p>}
      <Button variant="destructive" className="w-full" disabled={!confirmed || pending} onClick={run}>
        {pending ? t("deleting") : t("confirm")}
      </Button>
    </div>
  );
}
