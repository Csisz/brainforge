# BrainForge Kids AI — project rules
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
