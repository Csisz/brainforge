import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** History loading skeleton — mirrors the stacked session-card rows. */
export default async function HistoryLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-8 w-32" />
      <div aria-hidden className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-card border border-line bg-card px-4 py-4 shadow-soft"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
