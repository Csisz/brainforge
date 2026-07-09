import { setRequestLocale, getTranslations } from "next-intl/server";
import { CalendarX, SquarePlus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getSessions } from "@/lib/sessions/queries";
import { SessionCard } from "@/components/history/session-card";

export default async function HistoryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const sessions = await getSessions();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("history.title")}</h1>

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
