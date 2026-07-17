import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getChild } from "@/lib/children/queries";
import { ChildForm } from "@/components/children/child-form";
import { DeleteChild } from "@/components/children/delete-child";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AvatarId } from "@/lib/children/avatar-list";
import type { ThemeId } from "@/lib/worksheets/types";

export default async function EditChildPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const child = await getChild(id);
  if (!child) notFound();

  const t = await getTranslations();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href="/app/children"
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("nav.children")}
      </Link>

      <ChildForm
        mode="edit"
        childId={child.id}
        initial={{
          nickname: child.nickname,
          birthMonth: child.birth_month.slice(0, 7),
          avatar: child.avatar as AvatarId,
          themes: child.preferred_themes as ThemeId[],
          accessibility: {
            lowInk: child.accessibility.lowInk ?? false,
            highContrast: child.accessibility.highContrast ?? false,
            motorSupport: child.accessibility.motorSupport ?? false,
          },
        }}
      />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base">{t("deleteChild.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DeleteChild childId={child.id} nickname={child.nickname} />
        </CardContent>
      </Card>
    </div>
  );
}
