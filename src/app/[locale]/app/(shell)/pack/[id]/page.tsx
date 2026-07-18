import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getChild } from "@/lib/children/queries";
import { stripeConfigured } from "@/lib/stripe/config";
import { PackForm } from "@/components/pack/pack-form";
import type { ThemeId } from "@/lib/worksheets/types";

/**
 * Weekly-pack setup (Sprint 8 M2). The parent picks how many days and how long;
 * the action composes them all at once and hands off to one print document. `id`
 * is the child id.
 */
export default async function PackSetupPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const child = await getChild(id);
  if (!child) notFound();
  const t = await getTranslations("pack");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {child.nickname}
      </Link>
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink">{t("title")}</h1>
        <p className="mt-1 text-ink-soft">{t("subtitle")}</p>
      </div>
      <PackForm
        childId={child.id}
        defaultTheme={(child.preferred_themes[0] as ThemeId) ?? "nature"}
        stripeConfigured={stripeConfigured()}
      />
    </div>
  );
}
