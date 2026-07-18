-- Weekly pack (Sprint 8 M2) — "Heti csomag", printed ahead for printer-less
-- homes. A pack is several planned sessions composed at once and rendered as one
-- document. Sessions in a pack share a pack_id so the print route and the session
-- list can group them; it is null for ordinary one-off sessions. RLS is
-- unchanged — the existing owner-scoped policy on sessions already covers it.
alter table public.sessions add column pack_id uuid;
create index sessions_pack_idx on public.sessions(pack_id) where pack_id is not null;
