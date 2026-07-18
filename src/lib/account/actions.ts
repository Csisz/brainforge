"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDeletionEmail } from "@/lib/email/deletion";
import { signDeletionToken, verifyDeletionToken } from "./deletion-token";

/**
 * ACCOUNT DELETION (GDPR erasure) — restructured in Sprint 7 M7 into a two-step,
 * email-confirmed flow so a single click can never erase an account:
 *
 *   requestAccountDeletion → unmistakable email with a signed link
 *     → in-app confirmation PAGE (a bare GET never deletes)
 *       → deleteAccount, gated on BOTH the token AND the typed email.
 */

/**
 * Step 1: the signed-in user asks to delete their account. Mints a one-hour
 * token, emails the confirmation link, and RETURNS the url so the flow works
 * even where app email is not configured (local dev): the caller can show the
 * link directly. Never deletes anything.
 */
export async function requestAccountDeletion(locale: string): Promise<{ url?: string; emailed?: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "not_authenticated" };

  const token = signDeletionToken(user.id);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${base}/${locale}/account/delete?token=${encodeURIComponent(token)}`;

  const emailed = await sendDeletionEmail(user.email, locale, url);
  return { url, emailed };
}

/**
 * Step 2: actually erase the caller's OWN account. Requires the signed token
 * from the email (bound to this user, ≤1h old) AND the typed email — two
 * independent factors, so neither a leaked session nor a forwarded link is
 * enough alone. Deleting the auth user cascades through profiles → children →
 * sessions → worksheets → feedback → calibration → achievements → subscriptions.
 * Irreversible by design.
 */
export async function deleteAccount(confirmation: string, token: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  // The token must be valid and issued for THIS user.
  const verified = verifyDeletionToken(token);
  if (!verified || verified.userId !== user.id) return { error: "invalid_token" };

  // Typed confirmation must match the account email (case-insensitive).
  if (!user.email || confirmation.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { error: "confirmation_mismatch" };
  }

  // Requires the service role (auth admin). Deletes exactly user.id.
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };

  // Best-effort local sign-out; the session is already invalid post-delete.
  await supabase.auth.signOut().catch(() => {});
  return {};
}
