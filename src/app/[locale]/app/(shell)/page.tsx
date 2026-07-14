import { setRequestLocale, getTranslations } from "next-intl/server";
import { getChildren } from "@/lib/children/queries";
import { getSessions } from "@/lib/sessions/queries";
import { ageFromBirthMonth } from "@/lib/children/age";
import { lowestCoverageGoals } from "@/lib/children/goal-nudge";
import { ChildCard } from "@/components/dashboard/child-card";
import type { DevelopmentGoal } from "@/lib/worksheets/types";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const [children, sessions] = await Promise.all([getChildren(), getSessions()]);

  // Tally each child's session goals once, so every card's nudge is derived
  // from real history (or age-typical defaults when there's none).
  const goalsByChild = new Map<string, DevelopmentGoal[][]>();
  for (const s of sessions) {
    const arr = goalsByChild.get(s.child_id) ?? [];
    arr.push(s.goals as DevelopmentGoal[]);
    goalsByChild.set(s.child_id, arr);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("overview")}</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {children.map((child) => (
          <ChildCard
            key={child.id}
            child={child}
            nudgeGoals={lowestCoverageGoals(goalsByChild.get(child.id) ?? [], ageFromBirthMonth(child.birth_month))}
          />
        ))}
      </div>
    </div>
  );
}
