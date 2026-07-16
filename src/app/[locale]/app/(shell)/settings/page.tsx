import { setRequestLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { ProfileForm } from "@/components/settings/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile/queries";
import { getSubscription } from "@/lib/subscriptions/queries";
import { getChildren } from "@/lib/children/queries";
import { getGenerationAllowance } from "@/lib/entitlements/queries";
import { stripeConfigured } from "@/lib/stripe/config";
import { AdaptiveToggle } from "@/components/settings/adaptive-toggle";
import { BillingActions } from "@/components/settings/billing-actions";

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [profile, subscription, children] = await Promise.all([getProfile(), getSubscription(), getChildren()]);
  const allowance = user ? await getGenerationAllowance(user.id) : null;

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

      {children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("settings.adaptiveTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* One honest sentence: what it does, and what turning it off means. */}
            <p className="text-sm leading-snug text-ink-soft">{t("settings.adaptiveHint")}</p>
            <div className="mt-3 divide-y divide-line border-t border-line">
              {children.map((child) => (
                <AdaptiveToggle
                  key={child.id}
                  childId={child.id}
                  nickname={child.nickname}
                  enabled={child.adaptive_enabled !== false}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
          {allowance && (
            <p className="text-sm text-ink-soft">
              {t("settings.usageLabel")}:{" "}
              <span className="font-semibold text-ink">
                {allowance.unlimited
                  ? t("plan.unlimited")
                  : t("plan.usageUsed", { used: allowance.used, limit: allowance.limit })}
              </span>
            </p>
          )}
          <BillingActions tier={subscription?.tier ?? "free"} configured={stripeConfigured()} />
        </CardContent>
      </Card>
    </div>
  );
}
