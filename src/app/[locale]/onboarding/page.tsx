import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ChildForm } from "@/components/children/child-form";
import { stripeConfigured } from "@/lib/stripe/config";

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-paper px-4 py-12">
      <Link href="/" className="font-display text-lg font-extrabold tracking-tight text-ink">
        {t("appName")}
      </Link>
      <div className="w-full max-w-xl">
        <ChildForm mode="create" stripeConfigured={stripeConfigured()} />
      </div>
    </div>
  );
}
