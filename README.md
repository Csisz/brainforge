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
PDF (resvg + pdf-lib in a Supabase Edge Function) reuses the identical SVG
contract (Sprint 3).

**5. Child data is minimized and locked down.**
Children are stored as nickname + birth month only. Every table has RLS
keyed to the owning account. Treat all child rows as GDPR/COPPA-grade data
from day one.

**6. Rule-based session composer now, adaptive layer later.**
`activities/engine.ts` builds the one-click daily plan from time templates,
material availability, and goal→generator matching. The `SessionSlot`
contract is stable so the adaptive layer (PRD §7) can replace the difficulty
heuristic without touching the composer.

## Layout

```
src/lib/random.ts                     seeded PRNG (sfc32) — sole randomness source
src/lib/worksheets/types.ts           generator contract + closed domain unions
src/lib/worksheets/svg.ts             mm-based SVG builder
src/lib/worksheets/page.ts            A4/Letter page composer + answer keys
src/lib/worksheets/registry.ts        plugin registry
src/lib/worksheets/generators/        maze, tracing, pattern_completion (v1)
src/lib/activities/engine.ts          daily session composer
src/lib/ai/provider.ts                LLM abstraction layer (Anthropic adapter)
supabase/migrations/0001_init.sql     full schema + RLS + signup trigger
scripts/demo-worksheets.ts            engine proof + determinism test
```

`npm run demo:worksheets` generates sample sheets into `demo-output/` and
asserts that identical seeds produce identical output.

## Sprint roadmap

- **Sprint 1 (done):** engine core, 3 generators, session composer, schema, AI layer contract.
- **Sprint 2:** landing page + auth + onboarding + child profiles; session wizard (goal/theme/duration/materials); worksheet viewer with print CSS; OpenAI/Gemini adapters; design system on the tokens in `globals.css`.
- **Sprint 3:** remaining PRD §4 generators (symmetry, mirror drawing, hidden objects, memory cards, matching, logic grids, color-by-rule, connect-the-dots, counting, sequencing, cut & paste, visual scanning); Edge-Function batch PDF; activity history + dashboard.
- **Sprint 4:** feedback capture + adaptive difficulty; achievements; Stripe subscriptions; accessibility modes (dyslexia/ADHD/autism-friendly rendering).

## Deliberately deferred (TODO, per PRD roadmap — not invented features)

Camera verification, voice coach, AR, handwriting analysis, teacher/therapist
portals, offline packs. Also: enum codegen check (TS ↔ SQL), generator
golden-file tests, rate limiting on the free tier, therapist-plan audit log.
