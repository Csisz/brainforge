import { setRequestLocale, getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { verifyDeletionToken } from "@/lib/account/deletion-token";
import { getChildren } from "@/lib/children/queries";
import { DeleteConfirm } from "@/components/account/delete-confirm";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Account-deletion confirmation PAGE (Sprint 7 M7b) — where the email link
 * lands. Rendering it (a bare GET) never deletes anything: it only shows what
 * would be erased and the typed-confirmation form. Deletion happens solely
 * through the DeleteConfirm action, gated on the signed token + typed email.
 * The route sits under /account, which middleware protects, so an unauthenticated
 * click is redirected to login first.
 */
export default async function ConfirmDeleteAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  const { token: rawToken } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("accountDelete");
  const tCommon = await getTranslations("common");

  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const verified = user && token ? verifyDeletionToken(token) : null;
  const valid = Boolean(user?.email && token && verified && verified.userId === user.id);
  const children = valid ? await getChildren() : [];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper px-4 py-12">
      <Link href="/" className="font-display text-lg font-extrabold tracking-tight text-ink">
        {tCommon("appName")}
      </Link>
      <Card className="w-full max-w-md border-destructive/30">
        {valid ? (
          <>
            <CardHeader>
              <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="size-5" aria-hidden="true" />
              </span>
              <CardTitle>{t("title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-snug text-ink-soft">{t("intro")}</p>
              <div className="rounded-card border border-line bg-mist/60 p-3">
                <p className="text-sm font-medium text-ink">{t("whatTitle")}</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  <li>{t("whatChildren", { count: children.length })}</li>
                  <li>{t("whatAccount")}</li>
                </ul>
              </div>
              <DeleteConfirm email={user!.email!} token={token!} />
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle className="text-base">{t("expiredTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-snug text-ink-soft">{t("expiredBody")}</p>
              <Button asChild variant="outline">
                <Link href="/app/settings">{t("backToSettings")}</Link>
              </Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
