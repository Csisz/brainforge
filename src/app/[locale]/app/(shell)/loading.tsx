import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Dashboard loading skeleton (also the generic fallback for shell routes without
 * their own). Mirrors the child-card grid so the real content settles in place
 * rather than jumping.
 */
export default async function DashboardLoading() {
  const t = await getTranslations("common");
  return (
    <div role="status" className="space-y-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-8 w-40" />
      <div aria-hidden className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-3 rounded-card border border-line bg-card py-6 shadow-soft"
          >
            <Skeleton className="size-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="mt-1 h-8 w-4/5 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
