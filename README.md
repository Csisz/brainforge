# BrainForge Kids AI

AI-native SaaS that procedurally generates personalized developmental
activities and printable worksheets for children aged 2–10.
Source of truth: `BrainForge_Kids_AI_PRD_v1.docx`.

## Architecture decisions (v1)

**1. Worksheets are recipes, not files.**
A worksheet's identity is `(generatorId, generatorVersion, params, seed)`.
SVG is derived on demand; nothing rendered is ever stored. Consequences:
storage is metadata-cheap at any scale, every sheet is re-renderable forever,
uniqueness is a DB constraint (`unique(child_id, generator_id, seed)`), and
anti-repetition is a simple history query. `generatorVersion` is bumped on
any output-affecting change so old recipes keep reproducing exactly.

**2. Deterministic core, decorative AI.**
Geometry and answers come from seeded algorithms (`src/lib/random.ts` is the
only randomness source; `Math.random` is banned in generators). LLMs
(`src/lib/ai/provider.ts`) only produce language — theme stories, narration —
schema-validated with zod and replaced by static fallbacks on any failure.
The product must fully work with AI disabled. In a children's product this is
a safety property, not just a cost optimization.

**3. Generator plugin architecture.**
Every worksheet type implements `WorksheetGenerator` and registers in
`registry.ts`. The platform never knows what a maze is. Adding a type = one
file. Generators emit pure content; `page.ts` composes the printable page
(paper size, margins, header, i18n instruction, answer key) — chrome and
content never mix.

**4. Print pipeline: real-millimetre SVG.**
Pages are `width="210mm" viewBox="0 0 210 297"`, so browser print → PDF is
dimensionally exact with `@page { size: A4; margin: 0 }`. Server-side batch
PDF (resvg + pdf-lib in a Supabase Edge Function) will reuse the identical
SVG contract (still not built — see the roadmap).

**5. Child data is minimized and locked down.**
Children are stored as nickname + birth month only. Every table has RLS
keyed to the owning account. Treat all child rows as GDPR/COPPA-grade data
from day one.

**6. Rule-based session composer, with an adaptive layer on top.**
`activities/engine.ts` builds the one-click daily plan from time templates,
material availability, and goal→generator matching. The composer stayed pure
when the adaptive layer landed (Sprint 5): the server resolves calibration into
an `AdaptivePlan` and passes it in, so the rules live in one testable module and
the composer still knows nothing about the DB.

**7. The content layer carries the pedagogy, not the components.**
A parent with no pedagogy background must never meet a bare label. Three
message sections — `goalDescriptions`, `generatorDescriptions`, `activityHowTo`
— explain every goal, worksheet type and physical activity, in all locales.
They are content, not chrome: components look them up by id
(`generatorDescriptions.${generator.id}`), so registering a generator or
activity without its copy is a visible gap, never a silent one.

**8. Pictograms are drawn, not photographed.**
Physical activities (`src/lib/pictograms/`) are IKEA-style stick-figure strips
emitted as inline SVG on the same mm grid as worksheets — hand-authored fixed
geometry per activity (not seeded; unlike worksheets there is nothing to
randomize). `composePictogram(activityKey)` → SVG or `null`, guarded by
`hasPictogram()`, so coverage is deliberately partial: 5 of 17 activities have
a strip today and the rest fall back to text with no UI branch. What makes the
printed daily plan screen-free is the `activityHowTo` text, which every
activity has; the strips are an accelerant, not the mechanism. No illustration
assets, no CDN.

**9. Bilateral ("Itt-Ott") worksheets are a family, not a flag.**
`dual_path` and `dual_find` train two-hand simultaneous work. They are
ordinary generators — no special-casing in the platform — but their header
colors are *meaningful* (they tell each hand where to start), so print paths
must never grayscale them. `lowInk` already handles this by numbering inside
the dots.

**10. Adaptive difficulty optimizes for success, not challenge.**
Calibration is per (child, goal) — a child can be a 4 in fine_motor and a 2 in
working_memory. Every rule in `src/lib/adaptive/engine.ts` is asymmetric on
purpose: a step DOWN needs one bad session and no waiting; a step UP needs two
in a row and a 7-day gate; cold start is the age default MINUS ONE. Getting it
wrong upward costs a child their confidence, getting it wrong downward costs
them an easy afternoon — so the rules are not symmetric either. Boredom
(succeeded, didn't enjoy) rotates the material rather than raising the level:
bored is not ready. A step down anchors the next session to the generator that
child does best, because a hard moment should be followed by a guaranteed win.

Consequently a step down is **never** presented as regression: no arrows, no
red, no "performance", one neutral level indicator labelled "current level".
The level describes the material, not the child.

## Layout

```
src/lib/random.ts                     seeded PRNG (sfc32) — sole randomness source
src/lib/worksheets/types.ts           generator contract + closed domain unions
src/lib/worksheets/svg.ts             mm-based SVG builder
src/lib/worksheets/page.ts            A4/Letter page composer + answer keys
src/lib/worksheets/registry.ts        plugin registry — the only list of types
src/lib/worksheets/generators/        all 19 PRD §4 types (see below)
src/lib/pictograms/                   stick-figure strips for physical activities
src/lib/activities/engine.ts          daily session composer
src/lib/adaptive/engine.ts            calibration rules (pure, unit-tested)
src/lib/adaptive/queries.ts           the DB half: load rows, write decisions
src/lib/achievements.ts               achievement catalog + pure evaluation
src/lib/ai/provider.ts                LLM abstraction layer (Anthropic adapter)
supabase/migrations/                  schema + RLS (0003–0004 add the adaptive layer)
scripts/demo-worksheets.ts            engine proof + golden files
scripts/verify-worksheets.ts          worksheet composition regression guard
scripts/flow-test.ts                  headless end-to-end acceptance test
```

The 19 registered generators, by family:

| Family | Generators |
|---|---|
| Motor / pre-writing | `tracing`, `maze`, `mirror_drawing`, `cut_and_paste` |
| Visual perception | `pattern_completion`, `grid_copy`, `symmetry_grid`, `visual_search`, `hidden_objects` |
| Attention / memory | `matching`, `memory_cards`, `arrow_board` |
| Thinking | `logic_grid`, `sequencing`, `color_by_rule`, `counting`, `connect_the_dots` |
| Bilateral ("Itt-Ott") | `dual_path`, `dual_find` — see decision 9 |

Never hardcode that list: `allGenerators()` is the source, and the worksheet
catalog (`/app/worksheets`) renders itself from it — a new generator appears
there with a live preview the moment it registers.

## Regression guards

Four commands, in rising order of cost. The worksheet guards iterate
`allGenerators()`, so a new type is covered the moment it registers.

**`npm run test`** — unit tests (Node's built-in runner via tsx; no framework
dependency). Covers the adaptive calibration rules exhaustively, including the
edges that define the product promise: level-1 step-down, level-5 step-up, the
"exactly 7 days is still too soon" gate, cold-start clamping, and that a
freshly composed session stamps a goal on every worksheet slot.

**`npm run verify`** — worksheet composition. The catalog and the print route
share one composer with two modes, so a change made for a thumbnail can wreck a
printable page. It asserts both contracts per generator: thumbnail mode returns
the content viewBox with no chrome and a `box` that matches it; full-page mode
still emits a 210×297mm sheet with header and footer; both re-render
byte-identically. It also writes an HTML harness of every thumbnail for
eyeballing.

**`npm run demo:worksheets`** — golden files. Renders every generator into
`demo-output/`, which is **tracked on purpose**: seeds and the render date are
pinned, so output changes only when the engine changes. An unexpected
`demo-output/` diff is therefore a regression signal — read it, don't re-commit
it. Regenerate deliberately when a generator legitimately changes, and eyeball
the diff before committing.

**`npm run flow:test`** — the end-to-end product chain. Needs the local stack up
(`supabase start`) and drives it headlessly: magic-link signup via Mailpit →
child → a session containing a `dual_path` worksheet → print render → feedback
→ achievement. It asserts the properties the UI can't show you — that RLS hides
a child from an unauthenticated client, that `unique(child,generator,seed)`
rejects a repeat, that a recipe re-renders byte-identically, that `dual_path`
keeps its non-gray header colors, and that re-awarding achievements is
idempotent. Each run signs up a fresh throwaway user.

## Known issues (don't debug these twice)

- **`npm run build` warns that `process.version` is unsupported in the Edge
  Runtime.** It comes from `@supabase/supabase-js` via `src/lib/supabase/
  middleware.ts`, not from our code, and is harmless — the middleware runs fine.
  Only a clean build shows it; incremental builds cache it away.
- **Sheets are top-aligned under the header, not vertically centred.** Now that
  generators declare honest content boxes, a short sheet (e.g. `symmetry_grid`)
  leaves its slack at the bottom of the page rather than split above and below.
  The composer pins content to the top; centring it there is a one-line change
  that would move every golden file, so it is a deliberate open question rather
  than an oversight.
- **`npm run verify` skips `arrow_board` and `hidden_objects`** in the
  content-box check: they emit `transform`, and the extent scan reads absolute
  coordinates only. It says so when it skips. Both are healthy — verified
  against real `getBBox` in a browser, which is the tool to reach for if you
  need exact numbers.

## Local auth quickstart

1. Docker Desktop running → `supabase start` (after any config.toml change:
   `supabase stop && supabase start`).
2. `npm run dev`, open http://localhost:3000, sign in with any email.
3. **The magic link lands in Mailpit, not your real inbox:**
   http://localhost:54324 — open it there and click the link.
4. Google login is hidden by default locally (`NEXT_PUBLIC_AUTH_GOOGLE=0`);
   enabling it requires real OAuth credentials — see the commented
   `[auth.external.google]` block in `supabase/config.toml`.
5. If magic links stop arriving, check the auth rate limits in
   `supabase/config.toml` (`email_sent`, raised to 100/h for local dev).

## Sprint roadmap

- **Sprint 1 (done):** engine core, 3 generators, session composer, schema, AI layer contract.
- **Sprint 2 (done):** landing page + auth + onboarding + child profiles; session wizard (goal/theme/duration/materials); worksheet viewer with print CSS; OpenAI/Gemini adapters; design system on the tokens in `globals.css`.
- **Sprint 3 (done):** all remaining PRD §4 generators (19 total) plus the
  bilateral `dual_*` family; the content layer that explains every goal,
  worksheet and activity to a non-pedagogue parent; worksheet catalog at
  `/app/worksheets`; activity pictograms + screen-free daily-plan print;
  feedback capture and achievements.
- **Sprint 5 (done):** adaptive difficulty — per (child, goal) calibration,
  success-first rules, parent-facing framing that never reads as regression.
- **Next:** Edge-Function batch PDF; Stripe subscriptions; accessibility modes
  (dyslexia/ADHD/autism-friendly rendering).

## Deliberately deferred (TODO, per PRD roadmap — not invented features)

Camera verification, voice coach, AR, handwriting analysis, teacher/therapist
portals, offline packs. Also: enum codegen check (TS ↔ SQL), generator
golden-file tests, rate limiting on the free tier, therapist-plan audit log.
