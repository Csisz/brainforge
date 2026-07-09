import { setRequestLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { ProfileForm } from "@/components/settings/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile/queries";
import { getSubscription } from "@/lib/subscriptions/queries";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [profile, subscription] = await Promise.all([getProfile(), getSubscription()]);

  return (
    <div className="max-w-md space-y-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("nav.settings")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.profileTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            email={user?.email ?? ""}
            initialDisplayName={profile?.display_name ?? ""}
            initialPaperSize={profile?.paper_size ?? "a4"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("common.language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <LocaleSwitcher />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.subscriptionTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-ink-soft">
            {t("settings.currentPlanLabel")}:{" "}
            <span className="font-semibold text-ink">{t(`planTiers.${subscription?.tier ?? "free"}`)}</span>
          </p>
          <Button variant="outline" disabled title={t("settings.upgradeComingSoon")}>
            {t("settings.upgradeCta")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
