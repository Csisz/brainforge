import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SERVICE-ROLE client — bypasses RLS. The ONLY legitimate caller is a trusted
 * server context with no user session: the Stripe webhook, which must update a
 * subscription row it does not own (there is no authenticated user on a webhook
 * request). Never import this from a Server Component, a Server Action reachable
 * by a user, or anything that ships to the client. CLAUDE.md: the service-role
 * key never touches client code — this module is the single, guarded exception.
 */
export function createAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
