import { getTranslations } from "next-intl/server";
import type { StoredSessionPlan, StoredSessionSlot } from "@/lib/activities/engine";
import { SLOT_ICON } from "@/lib/activities/slot-icons";
import { cn } from "@/lib/utils";

async function slotLabel(slot: StoredSessionSlot, t: Awaited<ReturnType<typeof getTranslations>>): Promise<string> {
  if (slot.kind === "worksheet") return t(`generators.${slot.recipe.generatorId}`);
  return t(slot.activityKey);
}

/** Vertical timeline of session slots — shared by the landing sample plan (M2) and the real session view (M5). */
export async function SessionTimeline({ plan, className }: { plan: StoredSessionPlan; className?: string }) {
  const t = await getTranslations();

  return (
    <ol className={cn("flex flex-col gap-3", className)}>
      {await Promise.all(
        plan.slots.map(async (slot, i) => {
          const Icon = SLOT_ICON[slot.kind];
          const label = await slotLabel(slot, t);
          return (
            <li
              key={i}
              className="flex items-center gap-3 rounded-card border border-line bg-card px-4 py-3 shadow-soft"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="flex-1 text-sm font-medium text-ink">{label}</span>
              <span className="font-mono text-xs text-ink-soft">{slot.minutes}′</span>
            </li>
          );
        }),
      )}
    </ol>
  );
}
