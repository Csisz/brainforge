import { getTranslations } from "next-intl/server";
import { sendEmail } from "./provider";
import { esc } from "@/lib/worksheets/svg";

/**
 * Branded, localized auth emails (B6) — the confirmation and password-reset
 * messages the app sends via Resend when it's configured. Matches
 * supabase/templates/confirm_signup.html (paper #f4f3ef, forest-ink #1f2a24,
 * coral #ff6b5e call-to-action, Nunito wordmark, the dashed-line motif) and
 * renders every string from next-intl, so all three languages come from code.
 *
 * These go through the same best-effort `sendEmail` (bounded retries, never
 * throws). The caller decides what a `false` means — for signup we surface a
 * friendly "couldn't send" so the parent can retry.
 */
type Copy = { heading: string; body: string; button: string; ignore: string; footer: string };

function render(locale: string, url: string, c: Copy): string {
  const href = esc(url);
  return `<!doctype html>
<html lang="${esc(locale)}"><body style="margin:0;background:#f4f3ef;font-family:Nunito,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2a24;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3ef;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e8e3;">
        <tr><td style="padding:24px 28px 4px;font-weight:800;font-size:18px;color:#1f2a24;">Kalmo Kids</td></tr>
        <tr><td style="padding:0 28px;"><div style="border-top:2px dashed #e8e8e3;height:0;line-height:0;">&nbsp;</div></td></tr>
        <tr><td style="padding:16px 28px 4px;font-size:20px;font-weight:800;color:#1f2a24;">${esc(c.heading)}</td></tr>
        <tr><td style="padding:6px 28px 20px;font-size:15px;line-height:1.55;color:#5c6b62;">${esc(c.body)}</td></tr>
        <tr><td style="padding:0 28px 24px;">
          <a href="${href}" style="display:inline-block;background:#ff6b5e;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:10px;">${esc(c.button)}</a>
        </td></tr>
        <tr><td style="padding:0 28px 20px;font-size:13px;line-height:1.55;color:#8a938c;border-top:1px solid #f0efe9;padding-top:16px;">${esc(c.ignore)}</td></tr>
        <tr><td style="padding:12px 28px 24px;font-size:12px;color:#b6bdb6;">${esc(c.footer)}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendBranded(namespace: string, to: string, locale: string, url: string): Promise<boolean> {
  const t = await getTranslations({ locale, namespace });
  const c: Copy = {
    heading: t("heading"),
    body: t("body"),
    button: t("button"),
    ignore: t("ignore"),
    footer: t("footer"),
  };
  const text = `${c.heading}\n\n${c.body}\n\n${url}\n\n${c.ignore}\n\n${c.footer}`;
  return sendEmail({ to, subject: t("subject"), text, html: render(locale, url, c) });
}

/** Email-confirmation message for a new signup. `url` is our own confirm link. */
export function sendConfirmationEmail(to: string, locale: string, url: string): Promise<boolean> {
  return sendBranded("email.confirmation", to, locale, url);
}

/** Password-reset message. `url` is our own reset link. */
export function sendPasswordResetEmail(to: string, locale: string, url: string): Promise<boolean> {
  return sendBranded("email.reset", to, locale, url);
}
