"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendConfirmationEmail, sendPasswordResetEmail } from "@/lib/email/auth-emails";

// Local, non-exported helper — a "use server" file may only EXPORT async
// functions (CLAUDE.md), but private consts are fine.
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const confirmLink = (tokenHash: string, type: "signup" | "recovery", locale: string) =>
  `${appUrl()}/api/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=${type}&locale=${encodeURIComponent(locale)}`;

export async function signOut(locale: string): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}

/**
 * Branded, localized signup confirmation (B6). Called ONLY when Resend is
 * configured — the form falls back to Supabase's own email otherwise. Creates the
 * user via the admin API (which does NOT send Supabase's built-in email), mints a
 * confirm link from the returned token_hash, and sends our branded email. Never
 * throws; returns a typed error key the form maps to an auth.errors.* message.
 */
export async function registerWithEmail(input: {
  email: string;
  password: string;
  locale: string;
}): Promise<{ error?: string }> {
  const { email, password, locale } = input;
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({ type: "signup", email, password });
  if (error) {
    // Anti-enumeration: an already-registered address must not be revealed —
    // generateLink errors for an existing user, so treat that as a silent
    // success (no email), exactly like the client signUp path.
    const code = (error as { code?: string }).code ?? "";
    if (code === "email_exists" || /already|registered|exists/i.test(error.message)) return {};
    console.error("[email] registerWithEmail generateLink failed:", error.message);
    return { error: "generic" };
  }

  const tokenHash = data.properties?.hashed_token;
  if (!tokenHash) {
    console.error("[email] registerWithEmail: no hashed_token returned");
    return { error: "generic" };
  }

  const sent = await sendConfirmationEmail(email, locale, confirmLink(tokenHash, "signup", locale));
  if (!sent) {
    console.error("[email] confirmation email failed to send to", email);
    return { error: "emailSendFailed" };
  }
  return {};
}

/**
 * Branded, localized password reset (B6). Called ONLY when Resend is configured.
 * Anti-enumeration: ALWAYS returns success — an unknown address (generateLink
 * errors) simply sends nothing, and a send failure is logged, not surfaced — so
 * the form never reveals whether an account exists.
 */
export async function sendPasswordReset(input: { email: string; locale: string }): Promise<{ error?: string }> {
  const { email, locale } = input;
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) {
    if (error) console.error("[email] sendPasswordReset generateLink:", error.message);
    return {}; // stay silent — do not reveal whether the address exists
  }

  const sent = await sendPasswordResetEmail(email, locale, confirmLink(data.properties.hashed_token, "recovery", locale));
  if (!sent) console.error("[email] reset email failed to send to", email);
  return {};
}
