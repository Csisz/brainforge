"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Hard-delete the CALLER'S OWN account (GDPR right to erasure). It only ever
 * targets the authenticated user's id — never anyone else's — and requires the
 * user to type their email as confirmation, matched server-side. Deleting the
 * auth user cascades through profiles → children → sessions → worksheets →
 * feedback → calibration → achievements → subscriptions, so one delete removes
 * everything. Irreversible by design.
 */
export async function deleteAccount(confirmation: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

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
