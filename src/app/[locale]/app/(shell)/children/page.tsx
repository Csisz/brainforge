import { setRequestLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getChildren } from "@/lib/children/queries";
import { getAvatarIcon } from "@/lib/children/avatar-list";
import { ageFromBirthMonth } from "@/lib/children/age";
import { getCalibration } from "@/lib/adaptive/queries";
import { LevelPanel } from "@/components/adaptive/level-dots";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ChildrenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const children = await getChildren();

  const levelsByChild = Object.fromEntries(
    await Promise.all(
      children.map(async (child) => [
        child.id,
        (await getCalibration(child.id)).map((row) => ({ goal: row.goal, level: row.level })),
      ]),
    ),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold text-ink">{t("nav.children")}</h1>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/onboarding">
            <Plus className="size-4" aria-hidden="true" />
            {t("children.addChild")}
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children.map((child) => {
          const Icon = getAvatarIcon(child.avatar);
          return (
            <Card key={child.id}>
              <CardContent className="flex items-start gap-3 py-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="font-display font-bold text-ink">{child.nickname}</p>
                    <p className="text-sm text-ink-soft">
                      {t("dashboard.ageSuffix", { age: ageFromBirthMonth(child.birth_month) })}
                    </p>
                  </div>
                  {child.preferred_themes.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {child.preferred_themes.map((theme) => (
                        <Badge key={theme} variant="secondary" className="text-xs">
                          {t(`themes.${theme}`)}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <LevelPanel levels={levelsByChild[child.id] ?? []} className="border-t border-line pt-2" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
