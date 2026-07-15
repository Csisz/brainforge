-- Sprint 5 M1: adaptive difficulty ("success-first calibration").
--
-- Design notes:
--  * Calibration is per (child, goal), not per child: a 6-year-old can be a 4
--    in fine_motor and a 2 in working_memory, and averaging those into one
--    number is what makes generic worksheets feel wrong in both directions.
--  * The engine that reads this is pure (src/lib/adaptive/engine.ts); this
--    table is only its persisted state. Rules live in code, not in triggers.
--  * `level` is deliberately clamped in the DB as well as in the engine — a
--    child-facing difficulty is not something we want a bad write to escape.

create table public.calibration (
  child_id uuid not null references public.children(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  goal development_goal not null,
  level int not null default 3 check (level between 1 and 5),
  -- Step-ups are rate-limited (7 days) but step-downs are not: retreat is
  -- always allowed, so only the upward move needs a timestamp.
  last_step_up_at timestamptz,
  -- Set when we step down. The next session must include the generator this
  -- child has historically done best at for this goal — we follow a hard
  -- moment with a guaranteed win rather than another unknown.
  pending_anchor boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (child_id, goal)
);
create index calibration_owner_idx on public.calibration(owner_id);

-- Calibration runs when feedback is submitted. Feedback can be submitted more
-- than once for a session (the UI lets a parent reopen a session), and a
-- double-run would step a child down twice for one bad afternoon. This makes
-- the update idempotent per session.
alter table public.sessions
  add column calibration_processed_at timestamptz;

-- Per-child opt-out (Sprint 5 M4). Default on: the adaptive layer is the
-- product, not an experiment — but a parent who wants a fixed level gets one.
alter table public.children
  add column adaptive_enabled boolean not null default true;

alter table public.calibration enable row level security;

create policy "own calibration" on public.calibration
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
