-- Security A2 (P0): atomic, universal generation quota.
--
-- The free weekly cap and the anti-abuse rate limit were only enforced in
-- startSession and the pack flow. printWorksheetForChild and printRewardChart
-- (catalog + reward-chart picker) created worksheets with NO check — a free user
-- over their weekly limit could print unlimited sheets. This closes that by
-- routing EVERY worksheet-creating path through one atomic check-and-reserve.
--
-- The reservation is a row in generation_ledger, created in the SAME transaction
-- as the count under a per-owner advisory lock, so two concurrent requests at
-- cap-1 cannot both pass (no read-then-write TOCTOU in app code).

create table public.generation_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Weekly quota counts only rows with counts_quota = true. Reward charts are
  -- quota-exempt (motivation tool) but still rate-limited, so they insert a
  -- counts_quota = false row (counts toward the rate window, not the weekly cap).
  counts_quota boolean not null default true
);
create index generation_ledger_owner_recent_idx on public.generation_ledger(owner_id, created_at desc);

alter table public.generation_ledger enable row level security;

-- Read-own (the usage display reads it). No client write policy: the ledger is
-- written ONLY by reserve_generation (security definer). Mirrors the A1
-- subscriptions model — the client never writes its own entitlement state.
create policy "read own generation ledger" on public.generation_ledger
  for select using (owner_id = auth.uid());

/**
 * reserve_generation — atomic check-and-reserve for worksheet generation.
 *
 * p_count       how many units to reserve (1 for a single sheet, N for a pack).
 * p_counts_quota false for reward charts: rate-limited but exempt from the weekly
 *               free cap.
 *
 * Returns jsonb { allowed, reason, remaining, unlimited }. reason is one of
 * 'rate_limited' | 'quota_exceeded' | 'forbidden' | 'not_authenticated' | null.
 * All-or-nothing: on a pack, either all p_count units are reserved or none.
 *
 * The per-owner advisory xact lock serializes concurrent reservations for the
 * same owner, so the count and the insert are effectively one atomic step —
 * two callers at cap-1 cannot both succeed.
 *
 * Constants mirror src/lib/entitlements/limits.ts (PLAN_LIMITS.free = 3/week,
 * RATE_LIMIT_MAX = 10 / 60s). Keep them in sync — see the comment there.
 */
create or replace function public.reserve_generation(
  p_owner uuid,
  p_count int default 1,
  p_counts_quota boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_tier text;
  v_unlimited boolean;
  v_free_cap int := 3;        -- PLAN_LIMITS.free.weeklyWorksheets
  v_rate_max int := 10;       -- RATE_LIMIT_MAX
  v_week_start timestamptz := now() - interval '7 days';   -- WINDOW_DAYS
  v_rate_start timestamptz := now() - interval '60 seconds'; -- RATE_LIMIT_WINDOW_SEC
  v_used int;
  v_rate_count int;
begin
  -- A signed-in user may only reserve for themselves. A trusted server context
  -- (service_role: auth.uid() is null) may pass any owner (webhook/tests).
  if v_caller is not null and v_caller <> p_owner then
    return jsonb_build_object('allowed', false, 'reason', 'forbidden', 'remaining', 0, 'unlimited', false);
  end if;
  if p_owner is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated', 'remaining', 0, 'unlimited', false);
  end if;

  -- Serialize concurrent reservations for this owner (released at commit).
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 0));

  select tier into v_tier from subscriptions where owner_id = p_owner;
  v_tier := coalesce(v_tier, 'free');
  v_unlimited := v_tier in ('premium', 'family', 'school', 'therapist');

  -- Rate limit applies to EVERY tier (anti-abuse), counting all recent rows.
  select count(*) into v_rate_count
    from generation_ledger where owner_id = p_owner and created_at > v_rate_start;
  if v_rate_count + p_count > v_rate_max then
    return jsonb_build_object('allowed', false, 'reason', 'rate_limited', 'remaining', 0, 'unlimited', v_unlimited);
  end if;

  -- Weekly free cap: only counts_quota rows count, and only for the free tier.
  if not v_unlimited and p_counts_quota then
    select count(*) into v_used
      from generation_ledger
      where owner_id = p_owner and counts_quota = true and created_at > v_week_start;
    if v_used + p_count > v_free_cap then
      return jsonb_build_object('allowed', false, 'reason', 'quota_exceeded',
        'remaining', greatest(0, v_free_cap - v_used), 'unlimited', false);
    end if;
  end if;

  -- Reserve: one ledger row per unit, in this locked transaction.
  insert into generation_ledger (owner_id, counts_quota)
  select p_owner, p_counts_quota from generate_series(1, p_count);

  return jsonb_build_object(
    'allowed', true,
    'reason', null,
    'remaining', case when v_unlimited or not p_counts_quota then -1 else greatest(0, v_free_cap - coalesce(v_used, 0) - p_count) end,
    'unlimited', v_unlimited
  );
end $$;

grant execute on function public.reserve_generation(uuid, int, boolean) to authenticated, service_role;
