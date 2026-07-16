-- Sprint 5 (follow-up): close the rotate_variety gap.
--
-- Boredom (high success, low enjoyment) must not raise the level — bored is not
-- ready. Instead the next session for that goal changes the material. This
-- mirrors the pending_anchor lifecycle: the engine sets the flag, the next
-- composed session consumes it, and it is then cleared.

alter table public.calibration
  add column rotate_pending boolean not null default false;

-- Attribute each worksheet to the goal it was picked for, so "the 3 most recent
-- generators for this goal" is a plain indexed query instead of walking every
-- session's plan jsonb in JS. goal is a real property of the row (why the sheet
-- was chosen), stamped at insert from the same slot that already carries it, so
-- it cannot drift from the plan. Nullable: pre-Sprint-5 rows have no goal and
-- are simply excluded, the same graceful-degradation posture used everywhere
-- for legacy data.
alter table public.worksheets
  add column goal development_goal;
create index worksheets_goal_idx on public.worksheets(child_id, goal, created_at desc);
