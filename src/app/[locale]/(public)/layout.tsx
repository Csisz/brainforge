import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="whitespace-nowrap font-display text-base font-extrabold tracking-tight text-ink sm:text-lg">
            {t("common.appName")}
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">{t("nav.login")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">{t("nav.signupCta")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="font-display text-sm font-bold text-ink">{t("common.appName")}</p>
            <p className="mt-1 text-sm text-ink-soft">{t("footer.tagline")}</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <Link href="/privacy" className="text-ink-soft hover:text-ink">{t("footer.privacy")}</Link>
              <Link href="/terms" className="text-ink-soft hover:text-ink">{t("footer.terms")}</Link>
              <Link href="/imprint" className="text-ink-soft hover:text-ink">{t("footer.imprint")}</Link>
            </nav>
            <div className="flex items-center gap-4">
              <LocaleSwitcher />
              <p className="text-xs text-ink-soft">
                © {new Date().getFullYear()} {t("common.appName")} · {t("footer.rights")}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
