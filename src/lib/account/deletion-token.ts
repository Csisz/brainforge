import crypto from "node:crypto";

/**
 * Signed, expiring token for the account-deletion confirmation link (Sprint 7
 * M7b). Deletion is restructured so the email never deletes on its own: the link
 * carries this token to a confirmation PAGE, and only the explicit typed-confirm
 * action there erases anything. The token binds the link to one user for one
 * hour, so an old or forwarded email cannot delete a different account, and
 * "ignore this email and nothing happens" is literally true.
 *
 * HMAC over the service-role key (server-only, already required) — no new secret,
 * no DB table. Stateless: nothing to clean up if the link is never used.
 */

const TTL_MS = 60 * 60 * 1000; // 1 hour
const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "insecure-dev-secret";

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signDeletionToken(userId: string): string {
  const payload = `${userId}.${Date.now() + TTL_MS}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

/** Returns the userId the token was issued for, or null if malformed/tampered/expired. */
export function verifyDeletionToken(token: string): { userId: string } | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, "base64url").toString();
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [userId, expStr] = payload.split(".");
  if (!userId || !expStr || Date.now() > Number(expStr)) return null;
  return { userId };
}
