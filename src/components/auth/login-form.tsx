"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Mail, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Status = "idle" | "sending" | "sent" | "error";

const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";
// Build-time flag: Next inlines NODE_ENV, so the Mailpit hint (and its localhost
// URL) is dead-code-eliminated from production client bundles — no localhost
// string leaks to prod.
const IS_DEV = process.env.NODE_ENV !== "production";
const MAILPIT_URL = "http://localhost:54324";

/** True when running against a local dev origin — used only for dev hints. */
function isLocalhost(): boolean {
  return typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
}

export function LoginForm() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? `/${locale}/app`;

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorReason, setErrorReason] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setErrorReason(error?.message ?? "");
    setStatus(error ? "error" : "sent");
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  if (status === "sent") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("checkEmailTitle")}</CardTitle>
          <CardDescription>{t("checkEmailBody", { email })}</CardDescription>
        </CardHeader>
        {IS_DEV && isLocalhost() && (
          <CardContent>
            <p className="text-sm text-ink-soft">
              {t.rich("checkEmailLocalHint", {
                url: (chunks) => (
                  <a href={MAILPIT_URL} target="_blank" rel="noreferrer" className="font-medium text-crayon underline underline-offset-2">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {GOOGLE_ENABLED && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogle}
              disabled={googleLoading}
            >
              {googleLoading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <GoogleIcon />}
              {t("continueWithGoogle")}
            </Button>

            <div className="flex items-center gap-3 text-xs text-ink-soft">
              <span className="h-px flex-1 bg-line" />
              {t("orDivider")}
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        <form onSubmit={handleMagicLink} className="space-y-3">
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
          <Button type="submit" className="w-full gap-2" disabled={status === "sending"}>
            {status === "sending" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Mail className="size-4" aria-hidden="true" />
            )}
            {t("submitMagicLink")}
          </Button>
          {status === "error" && (
            <p className="text-sm text-destructive">
              {errorReason ? t("errorWithReason", { reason: errorReason }) : t("errorGeneric")}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.39l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
