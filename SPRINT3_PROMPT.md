# SPRINT 3 — Make every task self-explanatory + surface the new generators

Context: the engine now has **11 worksheet generators** (5 new: connect_the_dots,
counting, matching, symmetry_grid, visual_search — already registered, with
on-sheet instructions and demo renders in `demo-output/`). The message files
gained three new content sections in all locales (hu/en/de):

- `goalDescriptions.*` — one sentence per development goal (what it means)
- `generatorDescriptions.*` — 2 sentences per worksheet type (what the child
  does + what it trains)
- `activityHowTo.*` — parent-facing "how to play" instructions for every
  physical activity (keys like `warmup.simon_says`, `memory.cup_shuffle`)

Your job is to wire this content into the UI so a parent never sees a bare
label again. Do NOT rewrite the content; do NOT add new dependencies.
Verify `npm run typecheck` after each milestone.

## M1 — Session wizard: explain the choices
- Goal tiles: title stays; add the `goalDescriptions` sentence as small
  `text-ink-soft` copy inside the tile (always visible on desktop, and on
  mobile too — parents choose based on it; do not hide it behind hover).
- Theme/duration/materials tiles keep their current labels (self-evident).
- Difficulty slider: under it, one dynamic line explaining the current value
  (add `wizard.difficultyHint.{1..5}` messages in all three locales, e.g.
  hu 3 ≈ "Korának megfelelő kihívás").

## M2 — Worksheet catalog page `/app/worksheets`
New sidebar item ("Feladatlapok" / "Worksheets" / "Arbeitsblätter").
A grid of cards, one per registered generator (iterate `allGenerators()`,
never hardcode the list):
- live SVG preview rendered server-side via `composeWorksheet` with a fixed
  demo seed per generator id (stable previews, e.g. seed = `catalog-{id}`),
  age 5, difficulty 3, current locale
- localized name (`generators.*`) + description (`generatorDescriptions.*`)
- goal badges (localized `goals.*`) + supported age range
- a "Nyomtatás ehhez a gyerekhez" action: picks a child → creates a
  worksheet row with a fresh seed → routes to the existing print page.
This page doubles as the public gallery's grown-up sibling; keep it fast
(server components, no client JS except the action).

## M3 — Session timeline: parents must know how to run each activity
- Every physical slot (warmup/movement/memory/creative/reward/reflection)
  shows its `activityHowTo` text under the localized name — collapsed to
  2 lines with an expand toggle ("Hogyan játsszátok?").
- Worksheet slots show the `generatorDescriptions` sentence under the title.
- The print page answer-key section header gets a one-line note that the
  answer sheet is for the parent.

## M4 — Dashboard nudge
On each child card, under the CTA, show the three goals with the lowest
recent coverage (from session history goals; if no history, show the three
age-typical defaults) as small badges — with tooltips using
`goalDescriptions`. Keep it subtle; no charts yet (that's the adaptive
layer's sprint).

## Acceptance
A parent with zero pedagogy background can: pick goals understanding what
they mean, browse all 11 worksheet types with live previews and know what
each trains, and run every physical activity from the timeline text alone —
in all three languages. Screenshot each milestone (desktop + mobile),
self-critique, fix, then proceed.
