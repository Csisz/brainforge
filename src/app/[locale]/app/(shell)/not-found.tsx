import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

/**
 * Shown when a page in the shell calls notFound() — a session, child, or pack id
 * that doesn't exist or, after A3b, isn't yours (the query returns nothing rather
 * than erroring). Same warm treatment as the error boundary, rendered inside the
 * sidebar chrome, with a way back to the dashboard.
 */
export default async function AppShellNotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="py-10">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-card border border-dashed border-line bg-mist/40 px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-crayon-soft text-crayon-text">
          <SearchX className="size-6" aria-hidden="true" />
        </span>
        <div className="space-y-1.5">
          <p className="font-display text-xl font-extrabold text-ink">{t("title")}</p>
          <p className="text-ink-soft">{t("body")}</p>
        </div>
        <Button asChild size="lg" className="mt-2">
          <Link href="/app">{t("back")}</Link>
        </Button>
      </div>
    </div>
  );
}
