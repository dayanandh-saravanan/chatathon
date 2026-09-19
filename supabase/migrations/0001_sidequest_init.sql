-- SideQuest — initial schema.
--
-- Tables live in `public` with an `sq_` prefix on purpose. Supabase exposes
-- `public` to the Data API out of the box, so a teammate can point this repo at
-- a brand new project, run this one file, and be done — no dashboard clicking.
--
-- Access model: the browser never talks to Postgres. Every read and write goes
-- through Next.js route handlers using the secret key, which bypasses RLS. RLS
-- is enabled on every table with no anon/authenticated policies, so the
-- publishable key — which is public by design — grants nothing. Add policies
-- here when real per-user auth lands.

-- ---------------------------------------------------------------- enums
do $$ begin
  create type sq_quest_category as enum
    ('music','fitness','craft','outdoors','cooking','learning','art','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sq_quest_status as enum ('active','paused','done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sq_milestone_status as enum ('locked','current','done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sq_event_kind as enum ('meeting','focus','commute','personal','quest');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sq_window_status as enum
    ('proposed','accepted','declined','completed','missed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sq_post_kind as enum ('progress','milestone','rest','restart');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- tables
create table if not exists public.sq_members (
  id          text primary key,
  name        text not null,
  handle      text not null unique,
  role        text not null default '',
  initials    text not null,
  accent      text not null default '262 52% 62%',
  timezone    text not null default 'America/New_York',
  joined_at   timestamptz not null default now()
);

create table if not exists public.sq_quests (
  id                    text primary key,
  owner_id              text not null references public.sq_members(id) on delete cascade,
  title                 text not null,
  category              sq_quest_category not null default 'other',
  why                   text not null default '',
  target_date           date not null,
  weekly_minutes_target int  not null default 120 check (weekly_minutes_target between 0 and 2400),
  session_minutes       int  not null default 45  check (session_minutes between 10 and 240),
  status                sq_quest_status not null default 'active',
  created_at            timestamptz not null default now()
);
create index if not exists sq_quests_owner_idx on public.sq_quests(owner_id);

create table if not exists public.sq_milestones (
  id                 text primary key,
  quest_id           text not null references public.sq_quests(id) on delete cascade,
  position           int  not null,
  title              text not null,
  detail             text not null default '',
  estimated_sessions int  not null default 4 check (estimated_sessions > 0),
  sessions_done      int  not null default 0 check (sessions_done >= 0),
  status             sq_milestone_status not null default 'locked',
  completed_at       timestamptz,
  unique (quest_id, position)
);
create index if not exists sq_milestones_quest_idx on public.sq_milestones(quest_id);

create table if not exists public.sq_calendar_events (
  id         text primary key,
  owner_id   text not null references public.sq_members(id) on delete cascade,
  title      text not null,
  kind       sq_event_kind not null default 'meeting',
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  attendees  int,
  check (ends_at > starts_at)
);
create index if not exists sq_events_owner_start_idx on public.sq_calendar_events(owner_id, starts_at);

-- One row per member per day of wearable telemetry (WHOOP daily cycle shape).
create table if not exists public.sq_daily_signals (
  owner_id           text not null references public.sq_members(id) on delete cascade,
  day                date not null,
  recovery           int  not null check (recovery between 0 and 100),
  sleep_hours        numeric(4,2) not null,
  sleep_debt_minutes int  not null default 0,
  day_strain         numeric(4,2) not null check (day_strain between 0 and 21),
  resting_hr         int  not null,
  hrv_ms             int  not null,
  source             text not null default 'whoop-sim',
  primary key (owner_id, day)
);

create table if not exists public.sq_quest_windows (
  id           text primary key,
  owner_id     text not null references public.sq_members(id) on delete cascade,
  quest_id     text not null references public.sq_quests(id) on delete cascade,
  milestone_id text,
  day          date not null,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  minutes      int  not null check (minutes > 0),
  score        int  not null default 0 check (score between 0 and 100),
  rationale    text[] not null default '{}',
  risks        text[] not null default '{}',
  status       sq_window_status not null default 'proposed',
  created_at   timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists sq_windows_owner_day_idx on public.sq_quest_windows(owner_id, day);
create index if not exists sq_windows_quest_status_idx on public.sq_quest_windows(quest_id, status);

create table if not exists public.sq_posts (
  id              text primary key,
  author_id       text not null references public.sq_members(id) on delete cascade,
  quest_id        text not null references public.sq_quests(id) on delete cascade,
  kind            sq_post_kind not null default 'progress',
  body            text not null,
  glyph           text not null default '*',
  minutes         int,
  milestone_title text,
  created_at      timestamptz not null default now()
);
create index if not exists sq_posts_created_idx on public.sq_posts(created_at desc);

create table if not exists public.sq_cheers (
  post_id text not null references public.sq_posts(id) on delete cascade,
  user_id text not null references public.sq_members(id) on delete cascade,
  emoji   text not null default '+',
  primary key (post_id, user_id)
);

-- Nudges are derived from live signals, not stored. Only dismissals persist.
create table if not exists public.sq_nudge_dismissals (
  nudge_id     text not null,
  user_id      text not null references public.sq_members(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (nudge_id, user_id)
);

create table if not exists public.sq_agent_messages (
  id         text primary key,
  user_id    text not null references public.sq_members(id) on delete cascade,
  role       text not null check (role in ('user','agent')),
  content    text not null,
  actions    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists sq_agent_messages_user_idx on public.sq_agent_messages(user_id, created_at);

-- ---------------------------------------------------------------- security
alter table public.sq_members          enable row level security;
alter table public.sq_quests           enable row level security;
alter table public.sq_milestones       enable row level security;
alter table public.sq_calendar_events  enable row level security;
alter table public.sq_daily_signals    enable row level security;
alter table public.sq_quest_windows    enable row level security;
alter table public.sq_posts            enable row level security;
alter table public.sq_cheers           enable row level security;
alter table public.sq_nudge_dismissals enable row level security;
alter table public.sq_agent_messages   enable row level security;

-- Belt and braces: RLS already blocks these roles, and the grants are removed
-- too, so a leaked publishable key cannot even see the table definitions.
revoke all on public.sq_members,          public.sq_quests,
              public.sq_milestones,       public.sq_calendar_events,
              public.sq_daily_signals,    public.sq_quest_windows,
              public.sq_posts,            public.sq_cheers,
              public.sq_nudge_dismissals, public.sq_agent_messages
  from anon, authenticated;
