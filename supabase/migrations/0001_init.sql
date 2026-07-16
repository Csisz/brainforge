-- Kalmo Kids — initial schema (PRD §11)
-- Design notes:
--  * Worksheets store RECIPES (generator + version + params + seed), never SVG.
--  * All child data is behind RLS keyed to the owning account. Children are
--    personal data of minors — no table is readable without ownership.
--  * Enums mirror the closed TypeScript unions in src/lib/worksheets/types.ts;
--    keep them in sync (a codegen check is a Sprint-2 TODO).

create type development_goal as enum (
  'attention','working_memory','executive_function','visual_perception',
  'bilateral_coordination','fine_motor','pre_writing','pre_reading',
  'math_thinking','creativity','problem_solving'
);

create type theme_id as enum (
  'dinosaurs','princesses','space','ocean','farm','cars','robots',
  'unicorns','nature','magic','blocks','custom'
);

create type plan_tier as enum ('free','premium','family','school','therapist');

create type slot_kind as enum (
  'warmup','movement','worksheet','memory_game','creative','reward','reflection'
);

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en',
  role text not null default 'parent' check (role in ('parent','teacher','therapist')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- children
create table public.children (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  -- Data minimization: nickname + birth month only. Never full identity.
  nickname text not null,
  birth_month date not null,
  avatar text not null default 'star',
  preferred_themes theme_id[] not null default '{}',
  accessibility jsonb not null default '{}'::jsonb, -- {lowInk, highContrast, motorSupport, dyslexia, adhd, autism}
  created_at timestamptz not null default now()
);
create index children_owner_idx on public.children(owner_id);

-- ---------------------------------------------------------------- sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  goals development_goal[] not null,
  theme theme_id not null,
  duration_min int not null check (duration_min in (10,20,30,45)),
  materials text[] not null default '{}',
  difficulty int not null check (difficulty between 1 and 5),
  seed text not null,               -- session plan is reproducible from this
  plan jsonb not null,              -- SessionPlan snapshot (slots)
  status text not null default 'planned' check (status in ('planned','active','completed','abandoned')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index sessions_child_idx on public.sessions(child_id, created_at desc);

-- -------------------------------------------------------------- worksheets
create table public.worksheets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete set null,
  child_id uuid not null references public.children(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  generator_id text not null,
  generator_version int not null,
  params jsonb,                     -- null ⇒ defaultParams at render time
  seed text not null,
  created_at timestamptz not null default now(),
  unique (child_id, generator_id, seed)  -- uniqueness guarantee (PRD §6)
);
create index worksheets_recent_idx on public.worksheets(child_id, created_at desc);

-- ---------------------------------------------------------------- feedback
-- Adaptive layer input (PRD §7): one row per completed slot.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slot_index int not null,
  slot_kind slot_kind not null,
  completed boolean not null,
  success_rate numeric check (success_rate between 0 and 1),
  enjoyment int check (enjoyment between 1 and 5),
  time_spent_sec int,
  note text,
  created_at timestamptz not null default now()
);
create index feedback_session_idx on public.feedback(session_id);

-- ------------------------------------------------------------ achievements
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,               -- 'streak_7', 'first_maze', … (catalog in code)
  earned_at timestamptz not null default now(),
  unique (child_id, kind)
);

-- ------------------------------------------------------------ subscriptions
create table public.subscriptions (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  tier plan_tier not null default 'free',
  status text not null default 'active',
  current_period_end timestamptz,
  provider_customer_id text,        -- Stripe wiring: Sprint 4
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.sessions enable row level security;
alter table public.worksheets enable row level security;
alter table public.feedback enable row level security;
alter table public.achievements enable row level security;
alter table public.subscriptions enable row level security;

create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "own children" on public.children
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own sessions" on public.sessions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own worksheets" on public.worksheets
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own feedback" on public.feedback
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own achievements" on public.achievements
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "own subscription" on public.subscriptions
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Auto-create profile + free subscription on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, new.raw_user_meta_data->>'name');
  insert into public.subscriptions (owner_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
