import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { createClient } from "@/lib/supabase/server";
import { getChildren } from "@/lib/children/queries";

export default async function AppShellLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Middleware already gates unauthenticated requests; user is non-null here.

  const kids = await getChildren();
  if (kids.length === 0) redirect(`/${locale}/onboarding`);

  const t = await getTranslations("nav");

  return (
    <SidebarProvider>
      <AppSidebar userEmail={user?.email ?? ""} locale={locale} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
          {/* aria-label overrides the vendored sr-only "Toggle Sidebar" text. */}
          <SidebarTrigger aria-label={t("toggleSidebar")} />
          <Separator orientation="vertical" className="h-4" />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
