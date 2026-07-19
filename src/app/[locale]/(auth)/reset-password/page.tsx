import { Suspense } from "react";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

/**
 * Reset-password landing (Sprint 9 M0). Reached from the recovery email via the
 * callback, which has set a recovery session. NOT gated on being logged out —
 * the recovery session is exactly what lets ResetPasswordForm call updateUser.
 *
 * This page reads no cookies, so Next statically prerenders it — and
 * ResetPasswordForm calls useSearchParams (`?error=1`), which requires a Suspense
 * boundary or the production build bails out. Hence the wrapper.
 */
export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("common");
  return (
    <Suspense fallback={<p className="text-center text-sm text-ink-soft">{t("loading")}</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
