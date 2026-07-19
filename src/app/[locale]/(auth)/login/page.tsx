import { Suspense } from "react";
import { redirect } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(`/${locale}/app`);

  // LoginForm reads useSearchParams (`?next`, `?confirmed=1`) — wrap it so the
  // production build never bails out of prerendering (Next 15 requirement).
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-center text-sm text-ink-soft">{t("loading")}</p>}>
      <LoginForm />
    </Suspense>
  );
}
