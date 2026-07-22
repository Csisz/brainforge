import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Catalog loading skeleton — a title block plus the preview-card grid. Every card
 * renders a worksheet SVG on the server, so this page has real work to wait on.
 */
export default async function CatalogLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-soft">
            <Skeleton className="aspect-square w-full rounded-none border-b border-line" />
            <div className="flex flex-1 flex-col gap-3 p-4">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
              <Skeleton className="mt-auto h-8 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
