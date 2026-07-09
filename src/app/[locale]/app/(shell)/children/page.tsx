import { setRequestLocale, getTranslations } from "next-intl/server";
import { getChildren } from "@/lib/children/queries";
import { getAvatarIcon } from "@/lib/children/avatar-list";
import { ageFromBirthMonth } from "@/lib/children/age";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ChildrenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const children = await getChildren();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("nav.children")}</h1>
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
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
