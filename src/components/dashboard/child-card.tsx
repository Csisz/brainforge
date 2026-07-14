import { Flame } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GoalBadges } from "@/components/dashboard/goal-badges";
import { AchievementBadges } from "@/components/achievements/achievement-badges";
import { getAvatarIcon } from "@/lib/children/avatar-list";
import { ageFromBirthMonth } from "@/lib/children/age";
import type { ChildRow } from "@/lib/children/queries";
import type { DevelopmentGoal } from "@/lib/worksheets/types";
import type { AchievementKind } from "@/lib/achievements";

export async function ChildCard({
  child,
  nudgeGoals,
  achievements,
}: {
  child: ChildRow;
  nudgeGoals: DevelopmentGoal[];
  achievements: AchievementKind[];
}) {
  const t = await getTranslations("dashboard");
  const Icon = getAvatarIcon(child.avatar);
  const age = ageFromBirthMonth(child.birth_month);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
          <Icon className="size-8" aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-lg font-bold text-ink">{child.nickname}</p>
          <p className="text-sm text-ink-soft">{t("ageSuffix", { age })}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-xs text-ink-soft">
          <Flame className="size-3.5" aria-hidden="true" />
          {t("streakDays", { count: 0 })}
        </span>
        <Button asChild className="mt-2 w-full">
          <Link href={{ pathname: "/app/new-session", query: { child: child.id } }}>{t("todaySessionCta")}</Link>
        </Button>
        {achievements.length > 0 && (
          <div className="mt-1">
            <AchievementBadges kinds={achievements} />
          </div>
        )}
        {nudgeGoals.length > 0 && (
          <div className="mt-1 flex flex-col items-center gap-1.5">
            <span className="text-xs text-ink-soft">{t("nudgeLabel")}</span>
            <GoalBadges goals={nudgeGoals} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
