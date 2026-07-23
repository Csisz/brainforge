/**
 * Is the Resend transactional sender configured? (B6) Mirrors stripeConfigured():
 * a server-side boolean the auth pages pass to the client forms so they know
 * whether to take the branded app-sent path or fall back to Supabase's own email.
 *
 * env.ts validates these as all-or-nothing, so in a well-formed deployment both
 * are set or both are absent; we still check both here to be safe in local dev.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
