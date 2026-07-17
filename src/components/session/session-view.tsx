"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { Star, Printer, PartyPopper } from "lucide-react";
import type { StoredSessionSlot } from "@/lib/activities/engine";
import { SLOT_ICON } from "@/lib/activities/slot-icons";
import { submitSessionFeedback, type SlotFeedback, type Ease } from "@/lib/feedback/actions";
import { HowToPlay } from "@/components/session/how-to-play";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type WorksheetSlotData = { svg: string; worksheetId: string };

type Entry = { completed: boolean; enjoyment: number; ease: Ease | null };

const EASE_OPTIONS: Ease[] = ["easy", "ok", "hard"];

export function SessionView({
  sessionId,
  slots,
  worksheetData,
  pictograms,
  alreadyCompleted,
  upgradeCard,
}: {
  sessionId: string;
  slots: StoredSessionSlot[];
  worksheetData: Record<number, WorksheetSlotData>;
  /** Server-rendered inline-SVG pictogram strips keyed by slot index (physical slots only). */
  pictograms: Record<number, string>;
  alreadyCompleted: boolean;
  /** Server-rendered upgrade card, shown for the worksheet slot when gated. */
  upgradeCard?: React.ReactNode;
}) {
  const t = useTranslations();
  const router = useRouter();

  const [entries, setEntries] = useState<Record<number, Entry>>(() =>
    Object.fromEntries(slots.map((_, i) => [i, { completed: false, enjoyment: 0, ease: null }])),
  );
  const [submitting, setSubmitting] = useState(false);
  // Distinct from `alreadyCompleted` (server state as of page load): this is the
  // transient "just clicked Kész vagyunk in this visit" confirmation. A session
  // that was already completed on an earlier visit (e.g. reopened from History
  // to re-print a worksheet) must still show the full timeline, not this screen.
  const [justFinished, setJustFinished] = useState(false);
  const [error, setError] = useState(false);

  function setEntry(index: number, patch: Partial<Entry>) {
    setEntries((prev) => ({ ...prev, [index]: { ...prev[index]!, ...patch } }));
  }

  function slotLabel(slot: StoredSessionSlot): string {
    if (slot.kind === "worksheet") return t(`generators.${slot.recipe.generatorId}`);
    return t(slot.activityKey);
  }

  function activityHowTo(activityKey: string): string | undefined {
    // "activity.warmup.simon_says" → "activityHowTo.warmup.simon_says"
    const key = activityKey.replace(/^activity\./, "activityHowTo.");
    return t.has(key) ? t(key) : undefined;
  }

  async function handleFinish() {
    setSubmitting(true);
    setError(false);
    const payload: SlotFeedback[] = slots.map((slot, i) => ({
      slotIndex: i,
      slotKind: slot.kind,
      completed: entries[i]!.completed,
      enjoyment: entries[i]!.enjoyment || null,
      ease: entries[i]!.ease,
    }));
    const result = await submitSessionFeedback(sessionId, payload);
    if (result.error) {
      setError(true);
      setSubmitting(false);
      return;
    }
    setJustFinished(true);
    router.refresh();
  }

  if (justFinished) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-card px-6 py-12 text-center shadow-soft">
        <PartyPopper className="size-10 text-crayon-text" aria-hidden="true" />
        <p className="font-display text-xl font-extrabold text-ink">{t("sessionView.doneTitle")}</p>
        <p className="text-ink-soft">{t("sessionView.doneBody")}</p>
        <Button asChild className="mt-2">
          <Link href="/app">{t("sessionView.backToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={`/app/sessions/${sessionId}/print`} target="_blank">
            <Printer className="size-3.5" aria-hidden="true" />
            {t("sessionView.printPlan")}
          </Link>
        </Button>
      </div>
      <ol className="flex flex-col gap-4">
        {slots.map((slot, i) => {
          const Icon = SLOT_ICON[slot.kind];
          const worksheet = slot.kind === "worksheet" ? worksheetData[i] : undefined;
          const generatorId = slot.kind === "worksheet" ? slot.recipe.generatorId : undefined;
          const howTo = slot.kind === "worksheet" ? undefined : activityHowTo(slot.activityKey);
          return (
            <li key={i} className="rounded-card border border-line bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
                  <Icon className="size-4.5" aria-hidden="true" />
                </span>
                <span className="flex-1 text-sm font-medium text-ink">{slotLabel(slot)}</span>
                <span className="font-mono text-xs text-ink-soft">{slot.minutes}′</span>
              </div>

              {pictograms[i] && (
                // Trusted output: composePictogram() is our own deterministic renderer.
                <div
                  className="mt-3 overflow-x-auto [&>svg]:h-14 [&>svg]:w-auto"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: pictograms[i]! }}
                />
              )}

              {generatorId && (
                <p className="mt-2 text-xs leading-snug text-ink-soft">
                  {t(`generatorDescriptions.${generatorId}`)}
                </p>
              )}

              {howTo && <HowToPlay text={howTo} label={t("sessionView.howToToggle")} />}

              {worksheet && (
                <div className="mt-3 flex flex-col items-center gap-2 sm:flex-row sm:items-start">
                  <div
                    className="w-full max-w-[220px] overflow-hidden rounded-lg border border-line bg-white [&>svg]:h-auto [&>svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: worksheet.svg }}
                  />
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <Link href={`/app/worksheets/${worksheet.worksheetId}/print`} target="_blank">
                      <Printer className="size-3.5" aria-hidden="true" />
                      {t("print.printButton")}
                    </Link>
                  </Button>
                </div>
              )}

              {/* Gated worksheet slot: no sheet was generated, show the upgrade card. */}
              {slot.kind === "worksheet" && !worksheet && upgradeCard && (
                <div className="mt-3">{upgradeCard}</div>
              )}

              {!alreadyCompleted && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <Checkbox
                      checked={entries[i]!.completed}
                      onCheckedChange={(v) => setEntry(i, { completed: v === true })}
                    />
                    {t("sessionView.doneToggle")}
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        aria-label={t("sessionView.enjoymentStar", { star })}
                        aria-pressed={entries[i]!.enjoyment >= star}
                        onClick={() => setEntry(i, { enjoyment: star })}
                        className="p-0.5"
                      >
                        <Star
                          className={cn(
                            "size-5",
                            entries[i]!.enjoyment >= star ? "fill-crayon text-crayon" : "text-line",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Worksheet slots only, and only when a sheet actually exists (a
                  gated slot has nothing to rate): how it went calibrates the next
                  session's level for this goal. We never ask a parent to score
                  their child. */}
              {!alreadyCompleted && slot.kind === "worksheet" && worksheet && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-sm text-ink">{t("sessionView.easeLabel")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {EASE_OPTIONS.map((option) => {
                      const selected = entries[i]!.ease === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setEntry(i, { ease: option })}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition-colors",
                            selected
                              ? "border-crayon bg-crayon-soft text-crayon-text"
                              : "border-line bg-card text-ink-soft hover:bg-mist",
                          )}
                        >
                          {t(`sessionView.ease${option[0]!.toUpperCase()}${option.slice(1)}`)}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-ink-soft">{t("sessionView.easeHint")}</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!alreadyCompleted && (
        <>
          {error && <p className="text-sm text-destructive">{t("sessionView.errorGeneric")}</p>}
          <Button size="lg" className="w-full" onClick={handleFinish} disabled={submitting}>
            {submitting ? t("sessionView.finishing") : t("sessionView.finishCta")}
          </Button>
        </>
      )}
    </div>
  );
}
