-- Security A1 (P0): subscriptions are READ-ONLY for authenticated users.
--
-- The original "own subscription" policy (0001) was `for all`, which let any
-- signed-in user UPDATE their own row and set tier = 'premium'/'family' directly
-- from the client Supabase connection — a full paid-tier bypass of Stripe. Tier
-- and status must be written ONLY by:
--   * the Stripe webhook, using the service-role key (bypasses RLS), and
--   * the handle_new_user trigger, which is SECURITY DEFINER (it creates the
--     initial free row on signup and is unaffected by these policies).
-- A client may READ its own subscription (the plan gate needs it) but must NEVER
-- write it.
drop policy if exists "own subscription" on public.subscriptions;

-- SELECT-only for the owner. We deliberately create NO insert/update/delete
-- policy for the authenticated role: with RLS enabled and no write policy, every
-- client write is denied by default — which is exactly the intent. The
-- service-role key still bypasses RLS, so the webhook keeps working.
create policy "read own subscription" on public.subscriptions
  for select using (owner_id = auth.uid());
