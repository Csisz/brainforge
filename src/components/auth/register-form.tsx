"use client";

import { useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Loader2, MailCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerWithEmail } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const MIN_PASSWORD = 6; // matches Supabase minimum_password_length

/**
 * Email + password registration with email confirmation (Sprint 9 M0). Client
 * validates password length and match, then signUp — which, with Confirm email
 * ON, creates NO session. On success we show a "confirm your email" state rather
 * than logging the parent in; they confirm via the emailed link, then log in.
 */
/**
 * `emailConfigured` (B6): when Resend is set up we hand signup to the
 * registerWithEmail server action, which sends our branded 3-language
 * confirmation email; otherwise we keep the original client signUp, letting
 * Supabase send its own email (Mailpit locally). The pages decide which.
 */
export function RegisterForm({ emailConfigured }: { emailConfigured: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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

    // Branded path: the server action creates the user and sends our own email.
    // It stays anti-enumeration (a known address returns success with no email).
    if (emailConfigured) {
      const result = await registerWithEmail({ email, password, locale });
      if (result.error) {
        setErrorKey(`errors.${result.error}`);
        setSubmitting(false);
        return;
      }
      setSent(true);
      setSubmitting(false);
      return;
    }

    // Fallback: Supabase Auth sends the confirmation email (Mailpit locally).
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?flow=signup&locale=${locale}`,
      },
    });

    if (error) {
      const code = error.code ?? "";
      setErrorKey(code === "user_already_exists" || /already registered/i.test(error.message) ? "errors.emailInUse" : "errors.generic");
      setSubmitting(false);
      return;
    }
    // No session is created (Confirm email ON). Show the confirm-email state;
    // this also stays anti-enumeration for an already-registered address.
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
          <CardTitle>{t("register.checkEmailTitle")}</CardTitle>
          <CardDescription>{t("register.checkEmailBody", { email })}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">{t("register.loginLink")}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("register.title")}</CardTitle>
        <CardDescription>{t("register.subtitle")}</CardDescription>
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
            {submitting ? t("register.submitting") : t("register.submit")}
          </Button>
        </form>

        <p className="text-center text-sm text-ink-soft">
          {t("register.haveAccount")}{" "}
          <Link href="/login" className="font-medium text-crayon-text hover:underline">
            {t("register.loginLink")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
