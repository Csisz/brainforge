-- Stability B1: atomic + idempotent session / pack / feedback lifecycles.
--
-- Session and pack creation ran several sequential writes with no transaction: a
-- session insert then worksheet inserts (or N such sets for a pack). A later
-- failure left an orphaned/empty session or a partial pack, and there was no
-- guard against double-submit. Feedback save inserted rows non-idempotently and
-- ran calibration on whatever was written.
--
-- Fix: move each multi-write lifecycle into ONE security-definer RPC — a single
-- transaction, all-or-nothing — following the A2 reserve_generation pattern. The
-- RPCs COMPOSE with reserve_generation IN THE SAME TRANSACTION, so a reservation
-- is never consumed if the insert rolls back, and an insert never happens without
-- a reservation. Because security definer bypasses RLS, each RPC RE-ENFORCES A3b
-- ownership internally: every referenced child_id/session_id must belong to
-- p_owner. Idempotency: a per-submit key (sessions.idempotency_key / the pack_id)
-- makes a double-submit a no-op, and feedback upserts on (session_id, slot_index).

-- ── idempotency + de-dup ────────────────────────────────────────────────────
alter table public.sessions add column idempotency_key uuid;
create unique index sessions_owner_idem_idx on public.sessions(owner_id, idempotency_key)
  where idempotency_key is not null;

-- Collapse any pre-existing duplicate feedback (a session could be re-submitted
-- before this), keeping one row per slot, then lock it with a unique constraint.
delete from public.feedback f using public.feedback g
  where f.session_id = g.session_id and f.slot_index = g.slot_index and f.ctid < g.ctid;
alter table public.feedback add constraint feedback_session_slot_unique unique (session_id, slot_index);

-- ── create_session ──────────────────────────────────────────────────────────
-- Session row + its worksheet rows in ONE transaction. Reserves 1 unit; rate
-- limit hard-fails (no session), over-quota soft-gates (session with no worksheet,
-- no unit consumed). Returns { session_id, gated, idempotent } or { error }.
create or replace function public.create_session(
  p_owner uuid,
  p_child uuid,
  p_goals development_goal[],
  p_theme theme_id,
  p_duration int,
  p_materials text[],
  p_difficulty int,
  p_seed text,
  p_plan jsonb,
  p_worksheets jsonb,          -- [{generatorId,generatorVersion,params,seed,goal}]
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_existing uuid;
  v_res jsonb;
  v_gated boolean;
  v_session uuid;
begin
  if v_caller is not null and v_caller <> p_owner then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_owner is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;
  -- A3b: the child must belong to p_owner (security definer bypasses RLS).
  if not exists (select 1 from children where id = p_child and owner_id = p_owner) then
    return jsonb_build_object('error', 'forbidden_child');
  end if;

  -- Serialize per owner (same lock key as reserve_generation; xact locks are
  -- re-entrant, so reserve_generation's own acquisition is a no-op here).
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 0));

  if p_idempotency_key is not null then
    select id into v_existing from sessions where owner_id = p_owner and idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return jsonb_build_object('session_id', v_existing, 'gated', (select worksheets_gated from sessions where id = v_existing), 'idempotent', true);
    end if;
  end if;

  v_res := reserve_generation(p_owner, 1, true);
  if (v_res->>'reason') = 'rate_limited' then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  v_gated := not (v_res->>'allowed')::boolean;   -- quota_exceeded ⇒ soft gate

  insert into sessions (child_id, owner_id, goals, theme, duration_min, materials, difficulty, seed, plan, status, worksheets_gated, idempotency_key)
  values (p_child, p_owner, p_goals, p_theme, p_duration, p_materials, p_difficulty, p_seed, p_plan, 'active', v_gated, p_idempotency_key)
  returning id into v_session;

  if not v_gated then
    insert into worksheets (session_id, child_id, owner_id, generator_id, generator_version, params, seed, goal)
    select v_session, p_child, p_owner,
           w->>'generatorId', (w->>'generatorVersion')::int, nullif(w->'params', 'null'::jsonb),
           w->>'seed', nullif(w->>'goal', '')::development_goal
    from jsonb_array_elements(p_worksheets) w;
  end if;

  return jsonb_build_object('session_id', v_session, 'gated', v_gated, 'idempotent', false);
end $$;

-- ── create_pack ─────────────────────────────────────────────────────────────
-- All N planned sessions + their worksheets in ONE transaction — all-or-nothing.
-- Reserves the whole pack's worksheet count (partial packs impossible). The
-- client-supplied pack_id is the idempotency key. Returns { pack_id, gated,
-- idempotent } or { error }.
create or replace function public.create_pack(
  p_owner uuid,
  p_child uuid,
  p_pack_id uuid,
  p_theme theme_id,
  p_duration int,
  p_materials text[],
  p_goals development_goal[],
  p_difficulty int,
  p_sessions jsonb             -- [{ seed, plan, worksheets:[{...}] }]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_res jsonb;
  v_count int;
  v_session uuid;
  s jsonb;
begin
  if v_caller is not null and v_caller <> p_owner then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_owner is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;
  if not exists (select 1 from children where id = p_child and owner_id = p_owner) then
    return jsonb_build_object('error', 'forbidden_child');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner::text, 0));

  -- Idempotency: a resubmit reuses the pack_id, so an existing pack is a no-op.
  if exists (select 1 from sessions where pack_id = p_pack_id) then
    return jsonb_build_object('pack_id', p_pack_id, 'idempotent', true);
  end if;

  select coalesce(sum(jsonb_array_length(x->'worksheets')), 0)::int into v_count
    from jsonb_array_elements(p_sessions) x;

  v_res := reserve_generation(p_owner, v_count, true);
  if (v_res->>'reason') = 'rate_limited' then
    return jsonb_build_object('error', 'rate_limited');
  end if;
  if not (v_res->>'allowed')::boolean then
    return jsonb_build_object('gated', true);   -- over the weekly cap — no partial pack
  end if;

  for s in select * from jsonb_array_elements(p_sessions) loop
    insert into sessions (child_id, owner_id, goals, theme, duration_min, materials, difficulty, seed, plan, status, worksheets_gated, pack_id)
    values (p_child, p_owner, p_goals, p_theme, p_duration, p_materials, p_difficulty, s->>'seed', s->'plan', 'planned', false, p_pack_id)
    returning id into v_session;

    insert into worksheets (session_id, child_id, owner_id, generator_id, generator_version, params, seed, goal)
    select v_session, p_child, p_owner,
           w->>'generatorId', (w->>'generatorVersion')::int, nullif(w->'params', 'null'::jsonb),
           w->>'seed', nullif(w->>'goal', '')::development_goal
    from jsonb_array_elements(s->'worksheets') w;
  end loop;

  return jsonb_build_object('pack_id', p_pack_id, 'gated', false, 'idempotent', false);
end $$;

-- ── finalize_feedback ───────────────────────────────────────────────────────
-- Feedback rows + the session-completion state, written atomically and
-- idempotently (upsert on the slot key). Calibration runs in app code AFTER this
-- commits, so it only ever sees a fully-written, complete session. Returns
-- { child_id } or { error }.
create or replace function public.finalize_feedback(
  p_owner uuid,
  p_session uuid,
  p_entries jsonb              -- [{ slotIndex, slotKind, completed, enjoyment, successRate }]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_child uuid;
begin
  if v_caller is not null and v_caller <> p_owner then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_owner is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;
  -- A3b: the session must belong to p_owner.
  select child_id into v_child from sessions where id = p_session and owner_id = p_owner;
  if v_child is null then
    return jsonb_build_object('error', 'forbidden_session');
  end if;

  insert into feedback (session_id, owner_id, slot_index, slot_kind, completed, enjoyment, success_rate)
  select p_session, p_owner, (e->>'slotIndex')::int, (e->>'slotKind')::slot_kind,
         (e->>'completed')::boolean, nullif(e->>'enjoyment', '')::int, nullif(e->>'successRate', '')::numeric
  from jsonb_array_elements(p_entries) e
  on conflict (session_id, slot_index) do update set
    slot_kind = excluded.slot_kind, completed = excluded.completed,
    enjoyment = excluded.enjoyment, success_rate = excluded.success_rate;

  update sessions set status = 'completed', completed_at = now()
    where id = p_session and owner_id = p_owner;

  return jsonb_build_object('child_id', v_child);
end $$;

grant execute on function public.create_session(uuid, uuid, development_goal[], theme_id, int, text[], int, text, jsonb, jsonb, uuid) to authenticated, service_role;
grant execute on function public.create_pack(uuid, uuid, uuid, theme_id, int, text[], development_goal[], int, jsonb) to authenticated, service_role;
grant execute on function public.finalize_feedback(uuid, uuid, jsonb) to authenticated, service_role;
