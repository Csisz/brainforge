import { setRequestLocale } from "next-intl/server";
import { pickHeroWorksheet, regenerateGallery } from "@/lib/worksheets/actions";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { WorksheetGallery } from "@/components/marketing/worksheet-gallery";
import { ScreenFreePitch } from "@/components/marketing/screen-free-pitch";
import { Pricing } from "@/components/marketing/pricing";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [heroWorksheet, galleryItems] = await Promise.all([
    pickHeroWorksheet(locale),
    regenerateGallery(locale),
  ]);

  return (
    <div>
      <Hero locale={locale} initial={heroWorksheet} />
      <HowItWorks />
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <WorksheetGallery locale={locale} initialItems={galleryItems} />
      </section>
      <ScreenFreePitch locale={locale} />
      <Pricing />
    </div>
  );
}
