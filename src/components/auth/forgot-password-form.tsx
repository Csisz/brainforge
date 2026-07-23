"use client";

import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, MailCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendPasswordReset } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Forgot-password step 1 (Sprint 9 M0): collect the email and send a reset link.
 * The link lands on /api/auth/callback?flow=recovery, which establishes a
 * recovery session and forwards to /reset-password. Always shows the "sent"
 * state, so the form never reveals whether an account exists.
 */
/**
 * `emailConfigured` (B6): when Resend is set up, the sendPasswordReset server
 * action sends our branded 3-language reset email; otherwise Supabase Auth sends
 * its own (Mailpit locally). Either way this stays anti-enumeration.
 */
export function ForgotPasswordForm({ emailConfigured }: { emailConfigured: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    if (emailConfigured) {
      await sendPasswordReset({ email, locale }); // always success-looking
    } else {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?flow=recovery&locale=${locale}`,
      });
    }
    // Anti-enumeration: show the same confirmation regardless of the result.
    setSent(true);
    setSubmitting(false);
  }

  if (sent) {
    return (
      <Card>
        <CardHeader>
          <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
            <MailCheck className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>{t("forgot.sentTitle")}</CardTitle>
          <CardDescription>{t("forgot.sentBody", { email })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">{t("forgot.backToLogin")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("forgot.title")}</CardTitle>
        <CardDescription>{t("forgot.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <Button type="submit" className="w-full gap-2" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {submitting ? t("forgot.submitting") : t("forgot.submit")}
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
