import { setRequestLocale, getTranslations } from "next-intl/server";
import { LegalArticle } from "@/components/legal/legal-article";
import { LEGAL } from "@/lib/legal/content";
import type { AppLocale } from "@/i18n/routing";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("legal");
  return (
    <LegalArticle
      doc={LEGAL.privacy[locale as AppLocale]}
      labels={{ updated: t("updated"), draft: t("draftNotice") }}
    />
  );
}
