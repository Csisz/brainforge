import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/sessions/queries";
import { getChild } from "@/lib/children/queries";
import { getSessionWorksheets } from "@/lib/worksheet-records/queries";
import { buildWorksheetRenderContext } from "@/lib/worksheet-records/render-context";
import { getProfile } from "@/lib/profile/queries";
import { composeWorksheet } from "@/lib/worksheets/page";
import type { SessionPlan } from "@/lib/activities/engine";
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

  const plan = session.plan as SessionPlan;
  const [worksheetRecords, profile] = await Promise.all([getSessionWorksheets(id), getProfile()]);
  const ctx = buildWorksheetRenderContext(child, session, locale, profile?.paper_size ?? "a4");

  const worksheetData: Record<number, WorksheetSlotData> = {};
  plan.slots.forEach((slot, i) => {
    if (slot.kind !== "worksheet") return;
    const record = worksheetRecords.find(
      (w) => w.generator_id === slot.recipe.generatorId && w.seed === slot.recipe.seed,
    );
    if (!record) return;
    const { svg } = composeWorksheet(slot.recipe, ctx, { childName: child.nickname });
    worksheetData[i] = { svg, worksheetId: record.id };
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
        alreadyCompleted={session.status === "completed"}
      />
    </div>
  );
}
