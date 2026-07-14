import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/sessions/queries";
import { getChild } from "@/lib/children/queries";
import { getProfile } from "@/lib/profile/queries";
import { composePictogram, hasPictogram } from "@/lib/pictograms";
import { SLOT_ICON } from "@/lib/activities/slot-icons";
import type { SessionPlan } from "@/lib/activities/engine";
import { PrintButton } from "@/components/print/print-button";

/**
 * Daily-plan print route — the whole session on paper so a parent can run it
 * screen-free. Physical activities carry their how-to text and an inline-SVG
 * pictogram strip (composePictogram, server-rendered); worksheet slots point
 * to their own printable sheet.
 *
 * Outside the (shell) group on purpose: no sidebar chrome, exact A4. We never
 * apply a grayscale filter here — worksheet colours (e.g. dual_path's header
 * sequence) are meaningful and must print in colour.
 */
export default async function SessionPlanPrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const session = await getSession(id);
  if (!session) notFound();
  const [child, profile] = await Promise.all([getChild(session.child_id), getProfile()]);
  if (!child) notFound();

  const plan = session.plan as SessionPlan;
  const paperSize = profile?.paper_size ?? "a4";

  return (
    <div className="bg-paper">
      <style>{`
        @page { size: ${paperSize === "letter" ? "letter" : "A4"}; margin: 12mm; }
        @media print { html, body { margin: 0; padding: 0; } }
      `}</style>

      <div className="flex justify-center py-6 print:hidden">
        <PrintButton label={t("sessionView.printPlan")} />
      </div>

      <div className="mx-auto max-w-3xl px-6 pb-12 print:px-0 print:pb-0">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-extrabold text-ink">
            {t("print.dailyPlanTitle")} — {child.nickname}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{t("print.dailyPlanIntro")}</p>
        </header>

        <ol className="flex flex-col gap-4">
          {plan.slots.map((slot, i) => {
            const Icon = SLOT_ICON[slot.kind];
            const isWorksheet = slot.kind === "worksheet";
            const label = isWorksheet
              ? t(`generators.${slot.recipe.generatorId}`)
              : t(slot.activityKey);
            const rest = isWorksheet ? "" : slot.activityKey.replace(/^activity\./, "");
            const howToKey = `activityHowTo.${rest}`;
            const description = isWorksheet
              ? t(`generatorDescriptions.${slot.recipe.generatorId}`)
              : t.has(howToKey)
                ? t(howToKey)
                : undefined;
            const picto = !isWorksheet && hasPictogram(slot.activityKey)
              ? composePictogram(slot.activityKey)
              : null;

            return (
              <li
                key={i}
                className="break-inside-avoid rounded-card border border-line bg-card p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-sm font-bold text-ink">
                    {i + 1}. {label}
                  </span>
                  <span className="font-mono text-xs text-ink-soft">{slot.minutes}′</span>
                </div>

                {picto && (
                  // Trusted output: composePictogram() is our own deterministic renderer.
                  <div
                    className="mt-3 [&>svg]:h-16 [&>svg]:w-auto"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: picto }}
                  />
                )}

                {description && (
                  <p className="mt-2 text-sm leading-snug text-ink-soft">{description}</p>
                )}

                {isWorksheet && (
                  <p className="mt-1 text-xs font-medium text-crayon-text">
                    {t("print.dailyPlanWorksheetNote")}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
