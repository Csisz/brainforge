"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { deleteChild } from "@/lib/children/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Child deletion — a deliberately friction-ful danger zone, mirroring account
 * deletion. The destructive button stays disabled until the parent types the
 * child's exact nickname, so it can't be a mis-tap. The DB foreign keys cascade,
 * so removing the child removes its sessions, worksheets, feedback and progress.
 */
export function DeleteChild({ childId, nickname }: { childId: string; nickname: string }) {
  const t = useTranslations("deleteChild");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmed = typed.trim().toLowerCase() === nickname.trim().toLowerCase();

  function run() {
    startTransition(async () => {
      setError(false);
      const result = await deleteChild(childId);
      if (result.error) {
        setError(true);
        return;
      }
      router.push("/app/children");
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
            <Label htmlFor="delete-child-confirm">{t("confirmLabel", { nickname })}</Label>
            <Input
              id="delete-child-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={nickname}
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
