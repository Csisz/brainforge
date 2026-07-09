import { setRequestLocale } from "next-intl/server";
import { getChildren } from "@/lib/children/queries";
import { SessionWizard } from "@/components/wizard/session-wizard";

export default async function NewSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ child?: string }>;
}) {
  const { locale } = await params;
  const { child } = await searchParams;
  setRequestLocale(locale);
  const children = await getChildren();

  return <SessionWizard children={children} defaultChildId={child} />;
}
