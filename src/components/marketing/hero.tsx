import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { HeroDemo, type HeroWorksheet } from "./hero-demo";

export async function Hero({ locale, initial }: { locale: string; initial: HeroWorksheet }) {
  const t = await getTranslations();

  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-4 pt-14 pb-20 sm:px-6 sm:pt-20 md:grid-cols-2 md:items-start md:gap-10">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          {t("hero.headline")}
        </h1>
        <p className="mt-5 max-w-md text-lg text-ink-soft">{t("hero.subline")}</p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/app">{t("nav.signupCta")}</Link>
        </Button>
      </div>
      <div className="flex min-w-0 justify-center md:justify-end">
        <HeroDemo locale={locale} initial={initial} />
      </div>
    </section>
  );
}
