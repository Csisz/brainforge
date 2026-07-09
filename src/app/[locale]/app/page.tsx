import { setRequestLocale, getTranslations } from "next-intl/server";
import { getChildren } from "@/lib/children/queries";
import { ChildCard } from "@/components/dashboard/child-card";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("nav");
  const children = await getChildren();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-extrabold text-ink">{t("overview")}</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {children.map((child) => (
          <ChildCard key={child.id} child={child} />
        ))}
      </div>
    </div>
  );
}
