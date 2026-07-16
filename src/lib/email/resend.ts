import type { EmailMessage, EmailProvider } from "./provider";

/**
 * Resend adapter — ~30 lines of fetch against the Resend API, same shape as the
 * AI adapters. No SDK dependency. Any non-2xx or thrown error resolves to false;
 * the layer above treats that as "not sent" and moves on.
 */
export function resendProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY!;
  const from = process.env.EMAIL_FROM ?? "Kalmo Kids <onboarding@resend.dev>";

  return {
    id: "resend",
    async send(msg: EmailMessage): Promise<boolean> {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [msg.to],
          subject: msg.subject,
          text: msg.text,
          ...(msg.html ? { html: msg.html } : {}),
        }),
      });
      return res.ok;
    },
  };
}
