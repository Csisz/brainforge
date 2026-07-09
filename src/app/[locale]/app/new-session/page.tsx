import { setRequestLocale, getTranslations } from "next-intl/server";

export default async function NewSessionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("nav.newSession")}</h1>
      <p className="text-ink-soft">{t("common.comingSoon")}</p>
    </div>
  );
}
