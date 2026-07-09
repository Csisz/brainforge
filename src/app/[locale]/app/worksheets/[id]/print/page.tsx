import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getWorksheet } from "@/lib/worksheet-records/queries";
import { getSession } from "@/lib/sessions/queries";
import { getChild } from "@/lib/children/queries";
import { buildWorksheetRenderContext } from "@/lib/worksheet-records/render-context";
import { composeWorksheet } from "@/lib/worksheets/page";
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
  if (!worksheet || !worksheet.session_id) notFound();

  const [session, child] = await Promise.all([getSession(worksheet.session_id), getChild(worksheet.child_id)]);
  if (!session || !child) notFound();

  const ctx = buildWorksheetRenderContext(child, session, locale);
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
        @page { size: A4; margin: 0; }
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
          <div className="w-full [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: answerKeySvg }} />
        )}
      </div>
    </div>
  );
}
