/**
 * EMAIL ABSTRACTION LAYER — mirrors the AI layer (src/lib/ai/provider.ts).
 *
 * Transactional email is DECORATIVE, never load-bearing: a welcome note is nice
 * to have, but nothing in the product may depend on it arriving. So every send
 * goes through `sendEmail`, which returns a boolean and NEVER throws — on a
 * missing key, a network error, or a provider 500, it silently returns false and
 * the caller carries on. Providers are adapters selected by env, exactly like
 * the AI providers.
 *
 * Auth emails (magic links) are a separate concern: Supabase sends those via its
 * own SMTP config (Mailpit locally, Resend SMTP in production). This module is
 * only for app-sent mail.
 */
import { resendProvider } from "./resend";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailProvider {
  id: "resend";
  send(msg: EmailMessage): Promise<boolean>;
}

/** The configured provider, or null when email is not set up (local dev). */
export function createEmailProvider(): EmailProvider | null {
  return process.env.RESEND_API_KEY ? resendProvider() : null;
}

/**
 * Send an email, best-effort. Returns whether it was accepted; false means it
 * was skipped or failed, and the caller must treat that as normal.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const provider = createEmailProvider();
  if (!provider) return false; // no provider configured — silently skip
  try {
    return await provider.send(msg);
  } catch {
    return false; // provider is decorative; a failure is never fatal
  }
}
