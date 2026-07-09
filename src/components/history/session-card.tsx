import { getTranslations } from "next-intl/server";
import { getAvatarIcon } from "@/lib/children/avatar-list";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { SessionListItem } from "@/lib/sessions/queries";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  planned: "outline",
  active: "secondary",
  completed: "default",
  abandoned: "outline",
};

export async function SessionCard({ session, locale }: { session: SessionListItem; locale: string }) {
  const t = await getTranslations();
  const Icon = getAvatarIcon(session.children?.avatar ?? "");
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(session.created_at));

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">
            {session.children?.nickname ?? "—"} · {t(`themes.${session.theme}`)}
          </p>
          <p className="text-sm text-ink-soft">
            {date} · {t("common.minutes", { count: session.duration_min })}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[session.status] ?? "outline"}>
          {t(`history.status.${session.status}`)}
        </Badge>
        <Button asChild variant="outline" size="sm">
          <Link href={`/app/sessions/${session.id}`}>{t("history.viewCta")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
