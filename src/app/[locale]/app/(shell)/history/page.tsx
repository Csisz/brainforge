import { setRequestLocale, getTranslations } from "next-intl/server";
import { CalendarX, SquarePlus, Trophy } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getSessions } from "@/lib/sessions/queries";
import { getChildren, getAchievementsByChild } from "@/lib/children/queries";
import { getAvatarIcon } from "@/lib/children/avatar-list";
import { AchievementBadges } from "@/components/achievements/achievement-badges";
import { SessionCard } from "@/components/history/session-card";

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const [sessions, children, achievementsByChild] = await Promise.all([
    getSessions(),
    getChildren(),
    getAchievementsByChild(),
  ]);
  const trophied = children.filter((c) => (achievementsByChild[c.id]?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("history.title")}</h1>

      {trophied.length > 0 && (
        <section className="rounded-card border border-line bg-card p-4 shadow-soft">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Trophy className="size-5 text-crayon-text" aria-hidden="true" />
            {t("achievements.sectionTitle")}
          </h2>
          <div className="flex flex-col gap-3">
            {trophied.map((c) => {
              const Icon = getAvatarIcon(c.avatar);
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="w-20 shrink-0 text-sm font-medium text-ink">{c.nickname}</span>
                  <AchievementBadges kinds={achievementsByChild[c.id]!} size="md" />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-card px-6 py-16 text-center shadow-soft">
          <CalendarX className="size-10 text-ink-soft" aria-hidden="true" />
          <p className="font-display text-lg font-bold text-ink">{t("history.emptyTitle")}</p>
          <p className="text-ink-soft">{t("history.emptyBody")}</p>
          <Button asChild className="mt-2 gap-1.5">
            <Link href="/app/new-session">
              <SquarePlus className="size-4" aria-hidden="true" />
              {t("history.emptyCta")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
