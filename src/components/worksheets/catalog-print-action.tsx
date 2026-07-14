"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Printer, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { printWorksheetForChild } from "@/lib/worksheet-records/actions";
import { Button } from "@/components/ui/button";

type ChildOption = { id: string; nickname: string };

/**
 * The single client island on the catalog page (spec: "no client JS except the
 * action"). Picks a child, then calls the server action which creates the
 * worksheet row and redirects to the print page.
 */
export function CatalogPrintAction({
  generatorId,
  childOptions,
}: {
  generatorId: string;
  childOptions: ChildOption[];
}) {
  const t = useTranslations("worksheetsCatalog");
  const locale = useLocale();
  const [childId, setChildId] = useState(childOptions[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  if (childOptions.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-xs text-ink-soft">{t("noChildren")}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/children">{t("addChildCta")}</Link>
        </Button>
      </div>
    );
  }

  function handlePrint() {
    setError(false);
    startTransition(async () => {
      const result = await printWorksheetForChild(generatorId, childId, locale);
      if (result?.error) setError(true);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {childOptions.length > 1 && (
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            aria-label={t("chooseChild")}
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-card px-2 text-sm text-ink focus-visible:border-crayon focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crayon/40"
          >
            {childOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" onClick={handlePrint} disabled={pending} className="shrink-0 gap-1.5">
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Printer className="size-3.5" aria-hidden="true" />
          )}
          {pending ? t("preparing") : t("printForChild")}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{t("error")}</p>}
    </div>
  );
}
