import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getPackSessions } from "@/lib/pack/queries";
import { getChild } from "@/lib/children/queries";
import { getProfile } from "@/lib/profile/queries";
import { buildWorksheetRenderContext } from "@/lib/worksheet-records/render-context";
import { composeWorksheet } from "@/lib/worksheets/page";
import { getGenerator } from "@/lib/worksheets/registry";
import { composePictogram, hasPictogram } from "@/lib/pictograms";
import { activityMaterials, type StoredSessionPlan, type MaterialId } from "@/lib/activities/engine";
import { MATERIALS } from "@/lib/activities/material-list";
import { SLOT_ICON } from "@/lib/activities/slot-icons";
import { REWARD_FAMILIES } from "@/lib/worksheets/generators/reward-chart";
import { createRng } from "@/lib/random";
import { PrintButton } from "@/components/print/print-button";

/**
 * Weekly-pack print document (Sprint 8 M2) — one file to print ahead. For each
 * day: a daily-plan page (slots with how-to, pictograms and per-slot materials),
 * then that day's worksheet page(s). A single collection sheet closes it, sized
 * to the whole pack. Page breaks split every unit; @page margin 0 lets the
 * millimetre-exact worksheet SVGs fill their pages.
 */
export default async function PackPrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const tp = await getTranslations("pack");

  const sessions = await getPackSessions(id);
  if (sessions.length === 0) notFound();
  const [child, profile] = await Promise.all([getChild(sessions[0]!.child_id), getProfile()]);
  if (!child) notFound();
  const paperSize = profile?.paper_size ?? "a4";

  // Build every printable unit in order: per day → plan page + worksheet pages.
  const units: React.ReactNode[] = [];
  let totalSlots = 0;

  sessions.forEach((session, dayIndex) => {
    const plan = session.plan as StoredSessionPlan;
    totalSlots += plan.slots.length;
    const ctx = buildWorksheetRenderContext(child, session, locale, paperSize);
    const themeName = t(`themes.${session.theme}`);

    // 1) the day's plan page
    units.push(
      <div key={`plan-${dayIndex}`} className="pack-page px-[14mm] py-[12mm]">
        <header className="mb-5">
          <h2 className="font-display text-xl font-extrabold text-ink">
            {tp("dayTitle", { day: dayIndex + 1 })} · {child.nickname}
          </h2>
          <p className="mt-0.5 text-sm text-ink-soft">{themeName}</p>
        </header>
        <ol className="flex flex-col gap-3">
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
                ? t(howToKey, { theme: themeName })
                : undefined;
            const picto = !isWorksheet && hasPictogram(slot.activityKey) ? composePictogram(slot.activityKey) : null;
            const mats = isWorksheet ? [] : activityMaterials(slot.activityKey);
            return (
              <li key={i} className="break-inside-avoid rounded-card border border-line p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="flex-1 text-sm font-bold text-ink">
                    {i + 1}. {label}
                  </span>
                  <span className="font-mono text-xs text-ink-soft">{slot.minutes}′</span>
                </div>
                {picto && (
                  <div
                    className="mt-2 [&>svg]:h-12 [&>svg]:w-auto"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: picto }}
                  />
                )}
                {mats.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-ink-soft">{t("sessionView.needsMaterials")}</span>
                    {mats.map((m: MaterialId) => {
                      const MatIcon = MATERIALS.find((x) => x.id === m)?.icon;
                      return (
                        <span key={m} className="inline-flex items-center gap-1 rounded-full bg-mist px-2 py-0.5 text-xs text-ink-soft">
                          {MatIcon && <MatIcon className="size-3" aria-hidden="true" />}
                          {t(`materials.${m}`)}
                        </span>
                      );
                    })}
                  </div>
                )}
                {description && <p className="mt-1.5 text-xs leading-snug text-ink-soft">{description}</p>}
                {isWorksheet && (
                  <p className="mt-1 text-xs font-medium text-crayon-text">{tp("worksheetNote")}</p>
                )}
              </li>
            );
          })}
        </ol>
      </div>,
    );

    // 2) the day's worksheet pages (full-bleed millimetre SVGs)
    plan.slots.forEach((slot, i) => {
      if (slot.kind !== "worksheet") return;
      const { svg } = composeWorksheet(slot.recipe, ctx, { childName: child.nickname });
      units.push(
        <div
          key={`ws-${dayIndex}-${i}`}
          className="pack-sheet [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />,
      );
    });
  });

  // 3) one collection sheet for the whole pack — N = the tasks it contains.
  const rewardVersion = getGenerator("reward_chart").version;
  const family = createRng(`pack:${id}`).pick(REWARD_FAMILIES);
  const rewardCtx = buildWorksheetRenderContext(child, sessions[0]!, locale, paperSize);
  const { svg: rewardSvg } = composeWorksheet(
    { generatorId: "reward_chart", generatorVersion: rewardVersion, params: { n: totalSlots, family }, seed: `pack:${id}` },
    rewardCtx,
    { childName: child.nickname },
  );
  units.push(
    <div
      key="reward"
      className="pack-sheet [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: rewardSvg }}
    />,
  );

  return (
    <div className="bg-paper">
      <style>{`
        @page { size: ${paperSize === "letter" ? "letter" : "A4"}; margin: 0; }
        @media print { html, body { margin: 0; padding: 0; } }
        .pack-unit + .pack-unit { break-before: page; }
        .pack-page { min-height: 297mm; box-sizing: border-box; }
      `}</style>

      <div className="flex justify-center py-6 print:hidden">
        <PrintButton label={tp("printButton")} />
      </div>

      <div className="mx-auto max-w-3xl pb-12 print:max-w-none print:pb-0">
        {units.map((unit, i) => (
          <div key={i} className="pack-unit">
            {unit}
          </div>
        ))}
      </div>
    </div>
  );
}
