# SPRINT 2 — BrainForge Kids AI Frontend

You are continuing an existing project. Sprint 1 (done) built the procedural
worksheet engine, session composer, AI abstraction layer and the full
Supabase schema. **Read `README.md` first** — it documents the architecture
decisions. Do not change the engine contracts (`src/lib/worksheets/types.ts`,
`registry.ts`, `page.ts`, `activities/engine.ts`); build the UI on top of them.

## Step 0 — create `CLAUDE.md` in the repo root with exactly this content:

```markdown
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
```

## Design direction (locked — do not re-derive)

This is a **print-first** product: parents print paper worksheets. The UI's
world is paper, pencil strokes, tracing lines. The design must feel calm and
premium (Apple/Notion polish) with one warm, playful accent — never childish,
never cluttered, and explicitly NOT the generic AI look (no cream #F4F1EA +
serif + terracotta; no dark background + acid green).

**Tokens** (already in `src/app/globals.css`, extend but don't contradict):
- `--color-paper #fdfdfb` — page background, like worksheet stock
- `--color-ink #1f2a24` — deep forest-ink text
- `--color-ink-soft #5c6b62` — secondary text
- `--color-crayon #ff6b5e` — THE single action color (buttons, links, focus)
- `--color-crayon-soft #ffe9e6` — hover/selected fills
- `--color-mint #d9f0e4` — success, progress, completed states
- `--color-line #e8e8e3` — hairlines, card borders

**Type**: Nunito (700/800) for display — rounded warmth, kid-adjacent without
being childish. Inter (400/500/600) for body/UI. A mono face (IBM Plex Mono)
ONLY for seed chips and generator metadata. Load via `next/font`.

**Signature element** (the one memorable thing): the landing hero contains a
**live worksheet** — a real SVG rendered by `composeWorksheet()` with a
visible seed chip (e.g. `seed · a26052f1`) and a "Generate a new one" shuffle
button that re-renders with a fresh seed, instantly. The engine itself is the
demo; no mockups, no stock screenshots. Give it a subtle paper treatment
(soft shadow, 1° rotation, slight lift on regenerate).

**Recurring motif**: the dashed traceable stroke with a small start dot
(borrowed from the tracing worksheets). Use it as section dividers and the
"how it works" 3-step connector on the landing page. Use sparingly — this
motif plus the live hero are the personality; everything else stays quiet.

**Motion**: one orchestrated moment (hero worksheet regenerate: quick fade +
2mm lift + new render). Micro-interactions ≤150ms. Respect
`prefers-reduced-motion`. No scroll-jacking, no parallax.

**Quality floor**: responsive to 360px, visible keyboard focus
(crayon-colored ring), WCAG AA contrast, empty states that invite action,
errors that say what happened and what to do.

## Pages & flows (build in this order)

### M1 — Foundation
- next-intl setup, `hu` default, `en`/`de`; locale switcher in footer/settings.
- shadcn/ui init; restyle primitives to tokens (radius 1.25rem cards, soft
  shadows `0 2px 16px rgb(31 42 36 / 0.06)`).
- App shell: public layout (landing) + authed layout (sidebar: Áttekintés,
  Gyerekek, Új foglalkozás, Előzmények, Beállítások).

### M2 — Landing page `/`
Sections, top to bottom:
1. Hero: headline on the left ("Minden nap új feladatlap. Sosem ugyanaz." /
   value prop subline / CTA "Kezdjük el ingyen"), the LIVE worksheet demo on
   the right (client component calling composeWorksheet with a random
   generator from the registry, age 5, difficulty 3, hu locale).
2. "Hogyan működik" — 3 steps joined by the dashed-trace motif: profil →
   napi terv → nyomtatás.
3. Worksheet gallery: 6 live-rendered thumbnails (one per registered
   generator), each with its seed chip. Regenerate-all button.
4. Screen-free pitch: short copy block on the daily plan (movement + memory
   + creative slots), rendered as a sample 30-min plan from composeSession.
5. Simple pricing (Free: 3 sheets/week; Premium 9€/mo: unlimited + all
   themes; Family; School — from PRD §12), then footer.
Copy: plain, specific, active voice; write hu/en/de messages.

### M3 — Auth + onboarding
- Supabase Auth (email magic link + Google) via @supabase/ssr; middleware
  protecting `/app/*`.
- Onboarding wizard after first login: add first child (nickname, birth
  month, avatar picker from a small set of line-art animals, preferred
  themes, accessibility toggles: lowInk / highContrast / motorSupport).
  Data → `children` table.

### M4 — Dashboard + session wizard (the hero flow)
- Dashboard: child cards (avatar, age from birth_month, streak placeholder),
  one primary CTA per child: "Mai foglalkozás".
- Wizard (single page, 4 large tappable tile groups, not a multi-step form):
  development goals (multi, icons per goal), theme, duration (10/20/30/45),
  materials (multi). Difficulty comes from a simple heuristic for now
  (age-based default, manual override slider 1–5).
- Submit → composeSession() server action → persist session + worksheets
  rows → redirect to session view.

### M5 — Session view + print
- Session plan as a vertical timeline of slots (slot kind icon, minutes,
  localized activity text; worksheet slots render the actual SVG inline).
- Print: `/app/worksheets/[id]/print` route rendering ONLY the worksheet
  SVG(s) + answer key page, with `@page { size: A4; margin: 0 }` and a
  print button. Verify Chrome print preview is dimensionally exact.
- "Kész vagyunk" flow: per-slot feedback (done toggle, enjoyment 1–5) →
  `feedback` table.

### M6 — History + settings
- History: past sessions per child, re-print any worksheet (recipe → render).
- Settings: profile, locale, paper size (A4/Letter), subscription placeholder.

## Hard rules
- Never store rendered SVG anywhere (DB, storage, state persisted to server).
  Render from recipes on demand.
- Worksheet rendering on the server where possible (RSC returning the SVG
  string); the hero demo may render client-side (the engine is isomorphic).
- No new dependencies beyond: shadcn/ui, next-intl, lucide-react. Ask before
  anything else.
- TypeScript strict passes (`npm run typecheck`) at every milestone.
- After each milestone: screenshot desktop (1440) and mobile (390), critique
  against this brief ("would a parent pay for this?"), fix, then move on.

## Definition of done for Sprint 2
A visitor lands, watches a worksheet regenerate, signs up, creates a child,
generates a 30-minute plan, prints a pixel-perfect A4 worksheet with answer
key, marks the session done — all in Hungarian, English or German, on phone
or desktop, with zero hardcoded strings and zero stored SVGs.
