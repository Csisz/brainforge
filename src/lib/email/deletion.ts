import { getTranslations } from "next-intl/server";
import { sendEmail } from "./provider";
import { esc } from "@/lib/worksheets/svg";

/**
 * Account-deletion confirmation email (Sprint 7 M7b). Deliberately NOT a login
 * email: a red danger accent, an unambiguous subject, an explicit list of what
 * is erased, and a clear "ignore this and nothing happens". The button lands on
 * an in-app confirmation PAGE (never deletes on click) carrying a signed,
 * one-hour token. Sent through the same best-effort layer as the welcome note;
 * the caller also surfaces the link in-app so the flow never depends on delivery.
 */
export async function sendDeletionEmail(to: string, locale: string, confirmUrl: string): Promise<boolean> {
  const t = await getTranslations({ locale, namespace: "email.deletion" });
  const url = esc(confirmUrl);

  const text = `${t("heading")}\n\n${t("body")}\n\n${confirmUrl}\n\n${t("ignore")}\n\n${t("footer")}`;

  const html = `<!doctype html>
<html lang="${esc(locale)}"><body style="margin:0;background:#f4f3ef;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2a24;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e8e3;">
        <tr><td style="padding:24px 28px 8px;font-weight:800;font-size:18px;color:#1f2a24;">Kalmo Kids</td></tr>
        <tr><td style="height:3px;background:#d64545;"></td></tr>
        <tr><td style="padding:20px 28px 4px;font-size:20px;font-weight:800;color:#1f2a24;">${esc(t("heading"))}</td></tr>
        <tr><td style="padding:8px 28px 20px;font-size:15px;line-height:1.55;color:#5c6b62;">${esc(t("body"))}</td></tr>
        <tr><td style="padding:0 28px 24px;">
          <a href="${url}" style="display:inline-block;background:#d64545;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px;">${esc(t("button"))}</a>
        </td></tr>
        <tr><td style="padding:0 28px 24px;font-size:13px;line-height:1.55;color:#8a938c;border-top:1px solid #f0efe9;padding-top:16px;">${esc(t("ignore"))}</td></tr>
        <tr><td style="padding:16px 28px 24px;font-size:12px;color:#b6bdb6;">${esc(t("footer"))}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return sendEmail({ to, subject: t("subject"), text, html });
}
