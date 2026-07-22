# Kalmo Kids — project rules
> Product name is **Kalmo Kids** (user-facing brand, domain kalmokids.com).
> Internal names are intentionally NOT rebranded and are not brand surface:
> the repo/directory, npm package aside, the Supabase `project_id`, DB tables,
> and code identifiers may remain "brainforge". Historical SPRINT*.md build
> briefs are left as-is.

- Source of truth: README.md architecture decisions. Never store rendered
  SVG; worksheets are recipes (generatorId, version, params, seed).
- Math.random() is banned in src/lib/worksheets and src/lib/activities;
  use createRng from src/lib/random.ts.
- Server Components by default; "use client" only where interaction demands it.
- "use server" files export ONLY async functions — no consts, objects, types,
  enums or value re-exports; those go in a plain sibling module. Why: a value
  export makes the whole action module fail to load at runtime (the EASE_SUCCESS
  503 that broke session save), and neither build nor flow:test catches it.
- Any sprint touching server actions must smoke-test the critical paths in a real
  browser before commit — session save, account deletion, checkout, catalog
  print. Why: the QA gates don't catch runtime action-module failures; the bug
  above reached production with every gate green.
- All user-facing strings go through next-intl messages (hu, en, de). No
  hardcoded UI text in components.
- Design tokens live in src/app/globals.css @theme. Never introduce ad-hoc
  hex colors or fonts in components.
- Every table access respects RLS; use @supabase/ssr helpers, never the
  service-role key in client code.
- Schema changes reach production ONLY via migrations + `supabase db push` —
  never hand-applied DDL in the dashboard SQL Editor. Why: a hand-added pack_id
  column diverged local from remote, and the next db push failed on "column
  already exists".
- Run `supabase migration repair --status applied` only AFTER proving the content
  is really present (check pg_policies / to_regclass / to_regproc first). Why:
  repair writes the migration ledger, not the schema — a blind repair marks a
  migration applied while the actual protection may be missing (a false green on
  a security fix).
- Work incrementally: after each milestone run the app, screenshot, self-
  critique, then continue.
- CI runs seven gates on push/PR to main (see README → Continuous integration):
  lint · typecheck · test · verify · test:rls · flow:test · build. `test:rls`
  and `flow:test` require a REAL Supabase stack (Postgres + Auth + PostgREST),
  not a bare Postgres — CI starts one with `supabase start`. The build must stay
  network-independent: fonts are self-hosted (next/font/local), never
  next/font/google.
- Golden files (verify / demo:worksheets) are a regression signal, not something
  to update. If output shifts after an unrelated change (e.g. the font swap),
  investigate it — never regenerate goldens to make a gate pass.
- Never absorb a failing gate: no `|| true`, no deleting a failing step, no
  marking a known security gap green. A bounded, self-healing retry for a
  genuinely flaky test is acceptable ONLY if a real failure still fails the build
  (the flow:test dual_path pattern in B4).
- Known issue (not a rule): flow:test §3's dual_path search is randomized and can
  rarely miss; CI absorbs it with a bounded retry, but the non-deterministic
  search condition is the real bug, worth fixing properly one day.
