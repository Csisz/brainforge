import { getTranslations } from "next-intl/server";
import { sendEmail } from "./provider";

/**
 * Welcome note, sent once after a parent adds their first child. Best-effort:
 * returns whether it went out, but the caller never depends on it. Copy lives in
 * next-intl messages like everything else user-facing, rendered for the account's
 * locale.
 */
export async function sendWelcomeEmail(to: string, locale: string, childName: string): Promise<boolean> {
  const t = await getTranslations({ locale, namespace: "email.welcome" });
  return sendEmail({
    to,
    subject: t("subject"),
    text: t("body", { childName }),
  });
}
