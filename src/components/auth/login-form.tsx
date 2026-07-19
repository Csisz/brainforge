"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Email + password login (Sprint 9 M0). Replaces the magic-link primary path.
 * Distinguishes the two Supabase failures parents actually hit — wrong
 * credentials vs. an unconfirmed email — and links out to registration and
 * password reset. Shows an "email confirmed" banner when arriving from the
 * confirmation callback (`?confirmed=1`).
 */
export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? `/${locale}/app`;
  const justConfirmed = searchParams.get("confirmed") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorKey(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const code = error.code ?? "";
      if (code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
        setErrorKey("errors.emailNotConfirmed");
      } else if (code === "invalid_credentials" || /invalid login/i.test(error.message)) {
        setErrorKey("errors.invalidCredentials");
      } else {
        setErrorKey("errors.generic");
      }
      setSubmitting(false);
      return;
    }
    // Hard navigation so middleware sees the fresh session cookie immediately.
    window.location.href = next;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("login.title")}</CardTitle>
        <CardDescription>{t("login.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {justConfirmed && (
          <p className="flex items-center gap-2 rounded-card bg-mint/60 px-3 py-2 text-sm text-ink">
            <CheckCircle2 className="size-4 shrink-0 text-crayon-text" aria-hidden="true" />
            {t("confirmedBanner")}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("passwordLabel")}</Label>
              <Link href="/forgot-password" className="text-xs font-medium text-crayon-text hover:underline">
                {t("login.forgotPassword")}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {errorKey && <p className="text-sm text-destructive">{t(errorKey)}</p>}

          <Button type="submit" className="w-full gap-2" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {submitting ? t("login.submitting") : t("login.submit")}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-soft">
          {t("login.noAccount")}{" "}
          <Link href="/register" className="font-medium text-crayon-text hover:underline">
            {t("login.registerLink")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
