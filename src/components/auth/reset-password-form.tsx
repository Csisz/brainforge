"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const MIN_PASSWORD = 6;

/**
 * Forgot-password step 2 (Sprint 9 M0): the reset-link landing. The callback has
 * already established a recovery session, so the parent just types the new
 * password twice → updateUser({ password }). On success we sign out and send
 * them to log in fresh with the new password. An invalid/expired link (no
 * session) surfaces a clear message.
 */
export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const linkError = searchParams.get("error") === "1";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(linkError ? "reset.invalidLink" : null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorKey(null);

    if (password.length < MIN_PASSWORD) {
      setErrorKey("errors.passwordTooShort");
      return;
    }
    if (password !== confirm) {
      setErrorKey("errors.passwordMismatch");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      // Usually "Auth session missing" — the recovery link was invalid/expired
      // or opened in a different browser than requested it.
      setErrorKey("reset.invalidLink");
      setSubmitting(false);
      return;
    }
    await supabase.auth.signOut().catch(() => {});
    setDone(true);
    setSubmitting(false);
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-mint/60 text-crayon-text">
            <CheckCircle2 className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>{t("reset.successTitle")}</CardTitle>
          <CardDescription>{t("reset.successBody")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">{t("reset.toLogin")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("reset.title")}</CardTitle>
        <CardDescription>{t("reset.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">{t("confirmPasswordLabel")}</Label>
            <Input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {errorKey && <p className="text-sm text-destructive">{t(errorKey)}</p>}

          <Button type="submit" className="w-full gap-2" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {submitting ? t("reset.submitting") : t("reset.submit")}
          </Button>
        </form>

        <p className="text-center text-sm">
          <Link href="/login" className="font-medium text-crayon-text hover:underline">
            {t("forgot.backToLogin")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
