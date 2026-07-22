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
- All user-facing strings go through next-intl messages (hu, en, de). No
  hardcoded UI text in components.
- Design tokens live in src/app/globals.css @theme. Never introduce ad-hoc
  hex colors or fonts in components.
- Every table access respects RLS; use @supabase/ssr helpers, never the
  service-role key in client code.
- Work incrementally: after each milestone run the app, screenshot, self-
  critique, then continue.
- CI runs seven gates on push/PR to main (see README → Continuous integration):
  lint · typecheck · test · verify · test:rls · flow:test · build. `test:rls`
  and `flow:test` require a REAL Supabase stack (Postgres + Auth + PostgREST),
  not a bare Postgres — CI starts one with `supabase start`. The build must stay
  network-independent: fonts are self-hosted (next/font/local), never
  next/font/google.
