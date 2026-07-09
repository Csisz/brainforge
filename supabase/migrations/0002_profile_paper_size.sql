-- Sprint 2 M6: Settings needs a "paper size (A4/Letter)" preference (PRD-referenced
-- in CLAUDE_CODE_SPRINT2.md) that 0001_init.sql didn't include. Additive only —
-- mirrors src/lib/worksheets/types.ts PaperSize, defaults to the same 'a4' the
-- render pipeline already assumes everywhere else.
alter table public.profiles
  add column paper_size text not null default 'a4' check (paper_size in ('a4', 'letter'));
