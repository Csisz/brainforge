import { setRequestLocale } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

/**
 * Reset-password landing (Sprint 9 M0). Reached from the recovery email via the
 * callback, which has set a recovery session. NOT gated on being logged out —
 * the recovery session is exactly what lets ResetPasswordForm call updateUser.
 */
export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ResetPasswordForm />;
}
