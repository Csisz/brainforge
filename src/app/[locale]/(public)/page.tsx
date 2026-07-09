import { setRequestLocale, getTranslations } from "next-intl/server";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <p className="text-ink-soft">{t("appName")} — engine online. {t("comingSoon")}</p>
    </div>
  );
}
