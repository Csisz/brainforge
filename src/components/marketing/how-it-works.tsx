import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import { UserRound, CalendarCheck, Printer, type LucideIcon } from "lucide-react";
import { TraceConnector } from "./trace-connector";

const STEPS: Array<{ key: "step1" | "step2" | "step3"; icon: LucideIcon }> = [
  { key: "step1", icon: UserRound },
  { key: "step2", icon: CalendarCheck },
  { key: "step3", icon: Printer },
];

export async function HowItWorks() {
  const t = await getTranslations("howItWorks");

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <p className="text-center text-sm font-semibold uppercase tracking-wide text-crayon-text">{t("eyebrow")}</p>
      <div className="mx-auto mt-10 flex max-w-xs flex-col items-stretch gap-0 md:max-w-none md:flex-row md:items-start">
        {STEPS.map((step, i) => (
          <Fragment key={step.key}>
            {i > 0 && (
              <>
                <TraceConnector orientation="vertical" className="ml-6 h-8 md:hidden" />
                <TraceConnector orientation="horizontal" className="mt-6 hidden w-12 shrink-0 md:block lg:w-20" />
              </>
            )}
            <div className="flex flex-1 flex-col items-center text-center">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
                <step.icon className="size-5" aria-hidden="true" />
              </div>
              <p className="mt-3 font-display text-lg font-bold text-ink">{t(`${step.key}.title`)}</p>
              <p className="mt-1 max-w-[16rem] text-sm text-ink-soft">{t(`${step.key}.body`)}</p>
            </div>
          </Fragment>
        ))}
      </div>
    </section>
  );
}
