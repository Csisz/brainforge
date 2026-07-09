import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/sessions/queries";

/**
 * M4 stub — proves the wizard's redirect lands somewhere real. The actual
 * timeline/print/feedback UI is M5.
 */
export default async function SessionViewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");

  const session = await getSession(id);
  if (!session) notFound();

  const plan = session.plan as { slots: unknown[]; totalMinutes: number };

  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-extrabold text-ink">
        {t("appName")} — {plan.totalMinutes}′
      </h1>
      <p className="text-ink-soft">{t("comingSoon")}</p>
    </div>
  );
}
