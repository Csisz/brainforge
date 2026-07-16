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
