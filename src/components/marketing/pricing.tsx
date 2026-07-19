import { getTranslations } from "next-intl/server";
import { Check } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TIERS = ["free", "premium", "family", "school"] as const;

export async function Pricing() {
  const t = await getTranslations("pricing");
  const tNav = await getTranslations("nav");

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-crayon-text">{t("eyebrow")}</p>
        <h2 className="mt-2 font-display text-2xl font-extrabold text-ink sm:text-3xl">{t("title")}</h2>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((tier) => {
          const isPremium = tier === "premium";
          const isSchool = tier === "school";
          return (
            <div
              key={tier}
              className={cn(
                "flex flex-col rounded-card border bg-card p-6 shadow-soft",
                isPremium ? "border-crayon ring-1 ring-crayon" : "border-line",
              )}
            >
              {isPremium && (
                <span className="mb-3 inline-flex w-fit items-center rounded-full bg-crayon-soft px-2.5 py-0.5 text-xs font-semibold text-crayon-text">
                  {t("premium.badge")}
                </span>
              )}
              <h3 className="font-display text-lg font-bold text-ink">{t(`${tier}.name`)}</h3>
              {(tier === "free" || tier === "premium") && (
                <p className="mt-1 font-display text-2xl font-extrabold text-ink">{t(`${tier}.price`)}</p>
              )}
              <p className="mt-3 flex flex-1 items-start gap-2 text-sm text-ink-soft">
                <Check className="mt-0.5 size-4 shrink-0 text-crayon-text" aria-hidden="true" />
                {t(`${tier}.body`)}
              </p>
              <Button asChild variant={isPremium ? "default" : "outline"} className="mt-6">
                <Link href={isSchool ? "/login" : "/register"}>{isSchool ? t("cta.contact") : tNav("signupCta")}</Link>
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
