-- Security A3b (P0): tenant reference integrity.
--
-- The A3 attack matrix surfaced a real gap: RLS checked that a row's owner_id is
-- the caller, but NOT that the rows it REFERENCES also belong to the caller. So a
-- user could insert into their own row (passing the owner_id with check) while
-- pointing child_id/session_id at ANOTHER tenant's data — attaching someone
-- else's child/session to themselves, and in calibration squatting the
-- (child_id, goal) PK against a child that isn't theirs.
--
-- Fix: ADD a reference constraint to the with check on every table that points at
-- another owner-scoped row, so a user can only reference rows they own. The
-- existing owner_id checks and the USING clauses are unchanged (this only
-- tightens what may be WRITTEN). The security-definer paths (reserve_generation,
-- handle_new_user) bypass RLS and are unaffected; legitimate app flows reference
-- the caller's OWN children/sessions and keep passing.
--
-- The explicit `c.owner_id = auth.uid()` inside each EXISTS makes the check hold
-- regardless of the referenced table's own RLS.

-- sessions: the child must belong to the caller.
alter policy "own sessions" on public.sessions
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.children c where c.id = child_id and c.owner_id = auth.uid())
  );

-- worksheets: the child must belong to the caller; if a session is referenced, it
-- must too (catalog/reward worksheets have session_id null — allowed).
alter policy "own worksheets" on public.worksheets
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.children c where c.id = child_id and c.owner_id = auth.uid())
    and (
      session_id is null
      or exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid())
    )
  );

-- feedback: the session must belong to the caller (the child is owned transitively
-- through the session).
alter policy "own feedback" on public.feedback
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = auth.uid())
  );

-- calibration: the child must belong to the caller. This also closes the PK-squat
-- (its key is (child_id, goal) with no owner): a tenant can no longer INSERT any
-- calibration row for a child that isn't theirs, so it cannot collide the key on
-- another tenant's child — binding via with check is cleaner than reshaping the PK.
alter policy "own calibration" on public.calibration
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.children c where c.id = child_id and c.owner_id = auth.uid())
  );
