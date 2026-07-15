import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/sessions/queries";
import { getChild } from "@/lib/children/queries";
import { getSessionWorksheets } from "@/lib/worksheet-records/queries";
import { buildWorksheetRenderContext } from "@/lib/worksheet-records/render-context";
import { getProfile } from "@/lib/profile/queries";
import { composeWorksheet } from "@/lib/worksheets/page";
import { composePictogram, hasPictogram } from "@/lib/pictograms";
import type { StoredSessionPlan } from "@/lib/activities/engine";
import { SessionView, type WorksheetSlotData } from "@/components/session/session-view";

export default async function SessionViewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");

  const session = await getSession(id);
  if (!session) notFound();
  const child = await getChild(session.child_id);
  if (!child) notFound();

  const plan = session.plan as StoredSessionPlan;
  const [worksheetRecords, profile] = await Promise.all([getSessionWorksheets(id), getProfile()]);
  const ctx = buildWorksheetRenderContext(child, session, locale, profile?.paper_size ?? "a4");

  const worksheetData: Record<number, WorksheetSlotData> = {};
  // Pictogram strips are rendered here (server) so the pictogram library never
  // ships to the client; SessionView just injects the inline SVG.
  const pictograms: Record<number, string> = {};
  plan.slots.forEach((slot, i) => {
    if (slot.kind === "worksheet") {
      const record = worksheetRecords.find(
        (w) => w.generator_id === slot.recipe.generatorId && w.seed === slot.recipe.seed,
      );
      if (!record) return;
      const { svg } = composeWorksheet(slot.recipe, ctx, { childName: child.nickname });
      worksheetData[i] = { svg, worksheetId: record.id };
      return;
    }
    if (hasPictogram(slot.activityKey)) {
      const svg = composePictogram(slot.activityKey);
      if (svg) pictograms[i] = svg;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink">{t("newSession")}</h1>
        <p className="text-ink-soft">{child.nickname}</p>
      </div>
      <SessionView
        sessionId={session.id}
        slots={plan.slots}
        worksheetData={worksheetData}
        pictograms={pictograms}
        alreadyCompleted={session.status === "completed"}
      />
    </div>
  );
}
