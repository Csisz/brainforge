import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/** Children list loading skeleton — mirrors the header row + child-card grid. */
export default async function ChildrenLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
      <div aria-hidden className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-card border border-line bg-card p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
                <div className="flex gap-1">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="mt-1 h-8 w-full rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
