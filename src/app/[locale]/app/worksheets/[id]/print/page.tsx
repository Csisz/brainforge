import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getWorksheet } from "@/lib/worksheet-records/queries";
import { getSession } from "@/lib/sessions/queries";
import { getChild } from "@/lib/children/queries";
import { getProfile } from "@/lib/profile/queries";
import { buildWorksheetRenderContext } from "@/lib/worksheet-records/render-context";
import { composeWorksheet } from "@/lib/worksheets/page";
import { ageFromBirthMonth } from "@/lib/children/age";
import { defaultDifficulty } from "@/lib/activities/difficulty";
import { PrintButton } from "@/components/print/print-button";

export default async function WorksheetPrintPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("print");

  const worksheet = await getWorksheet(id);
  if (!worksheet) notFound();

  const [session, child, profile] = await Promise.all([
    worksheet.session_id ? getSession(worksheet.session_id) : Promise.resolve(null),
    getChild(worksheet.child_id),
    getProfile(),
  ]);
  if (!child) notFound();

  const paperSize = profile?.paper_size ?? "a4";
  // Session worksheets freeze their difficulty/theme; catalog worksheets (no
  // owning session) derive a sensible context from the child at print time.
  const renderSource = session
    ? { difficulty: session.difficulty, theme: session.theme }
    : {
        difficulty: defaultDifficulty(ageFromBirthMonth(child.birth_month)),
        theme: child.preferred_themes[0] ?? "nature",
      };
  const ctx = buildWorksheetRenderContext(child, renderSource, locale, paperSize);
  const { svg, answerKeySvg } = composeWorksheet(
    {
      generatorId: worksheet.generator_id,
      generatorVersion: worksheet.generator_version,
      params: worksheet.params,
      seed: worksheet.seed,
    },
    ctx,
    { childName: child.nickname },
  );

  return (
    <div className="bg-paper">
      <style>{`
        @page { size: ${paperSize === "letter" ? "letter" : "A4"}; margin: 0; }
        @media print {
          html, body { margin: 0; padding: 0; }
        }
      `}</style>

      <div className="flex justify-center py-6 print:hidden">
        <PrintButton label={t("printButton")} />
      </div>

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 pb-12 print:gap-0 print:pb-0">
        <div
          className="w-full break-after-page [&>svg]:w-full [&>svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        {answerKeySvg && (
          <>
            {/* Screen-only guidance — kept out of print so the answer page stays A4-exact. */}
            <p className="w-full text-center text-xs text-ink-soft print:hidden">{t("answerKeyNote")}</p>
            <div className="w-full [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: answerKeySvg }} />
          </>
        )}
      </div>
    </div>
  );
}
