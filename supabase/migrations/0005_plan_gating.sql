-- Sprint 6 M1: free-tier plan gating.
--
-- A session whose worksheet slot was gated (free account over its weekly limit)
-- still composes and shows its physical activities — only the worksheet is held
-- back, replaced by an upgrade card. We record that on the session so the view
-- can trust it, and we simply do not create a worksheet row for it (so it never
-- counts against a future window and there is nothing to print).

alter table public.sessions
  add column worksheets_gated boolean not null default false;

-- The generation count is a plain owner-scoped range query over worksheets;
-- this index keeps it cheap as history grows.
create index if not exists worksheets_owner_recent_idx
  on public.worksheets(owner_id, created_at desc);
