import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Session view loading skeleton — a header block plus a column of slot cards,
 * matching the shape SessionView settles into (worksheets are composed on the
 * server, so this route genuinely waits on data).
 */
export default async function SessionLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div aria-hidden className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-card border border-line bg-card p-4 shadow-soft">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
