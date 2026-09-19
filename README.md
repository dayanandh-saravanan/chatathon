# SideQuest

SideQuest is an agentic hobby network for teams. Its agent reads your calendar
load and your WHOOP-style recovery signals, turns them into a single capacity
score, and only books hobby time into windows where you can actually show up.
On a day you are depleted it books nothing, tells you why, and asks a teammate
to check in on whoever has gone quiet.

## The WHOOP track framing

The track is health, well-being, and the way people work. SideQuest sits exactly
on that seam. Work does not announce that it is taking your hobbies; it just
fills the calendar until the guitar becomes furniture. Wearable data already
knows when a person is spent. Calendars already know when a day was brutal.
Nothing joins the two and then *acts* on the answer. SideQuest does, and the
action it is proudest of is refusal.

## The insight

**Free time is not the same as capable time.**

Every scheduling tool on earth finds a gap and fills it. After six hours of
meetings you are free at 7pm and useless at 7pm — the gap is real and the
session still does not happen. Book enough of those and you conclude you are
the kind of person who does not stick with things, which is how hobbies
actually die.

So SideQuest treats capacity, not availability, as the thing worth scheduling
against. It under-prescribes on purpose. A 25-minute session you finish beats a
90-minute one you bail on, and a night with nothing on it beats a night with
something you were always going to skip.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000 — it redirects to `/today`.

That is the whole setup. With no configuration the app runs on an in-memory
repository seeded from a generated world, which is fully functional and resets
when the process restarts.

Two things are optional. Copy `.env.example` to `.env.local` to turn them on:

| Variable | Effect when set |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Persists to Postgres instead of memory. Apply `supabase/migrations/0001_sidequest_init.sql` first. |
| `ANTHROPIC_API_KEY` | The agent writes its own prose. Without it, deterministic copy is used and every number is identical. |

If Supabase is configured but unreachable, the app logs a warning and falls back
to memory rather than failing — a demo should not die on a network blip.
`GET /api/health` returns `{ ok, repository }` so you can check which store is
actually live before you present.

The store seeds itself on the first request, so a cold clone or an empty
database just works. `npm run seed` force-reloads the demo dataset; you only
need it against Supabase, when you want the world regenerated relative to today.

## Architecture

```
src/
  app/(app)/          Five routes — today, plan, quests, feed, team — plus the shell
  app/api/            Route handlers: agent, quests, windows, posts, nudges, health
  components/         Presentation; client components only where interaction demands it
  lib/domain/         Pure decision logic: capacity, scheduling, streaks, nudges, time
  lib/data/           Repository boundary (memory or Supabase), seed world, read/derive service
  lib/agent/          The Anthropic wrapper — it writes sentences, it never decides numbers
supabase/
  migrations/         One SQL file: schema, enums, RLS locked to the server key
```

Three boundaries carry the weight:

- **`lib/domain` is pure and has no I/O.** Capacity, scheduling, streaks and
  nudges are functions of their inputs, so they are trivially inspectable and
  cannot be changed by where the data is stored.
- **`lib/data/service.ts` is the only thing pages and routes read from.** The
  repository underneath it is deliberately dumb — raw entity access, no domain
  logic — so swapping Postgres for anything else can never change what the
  product decides.
- **The model is optional by construction.** Every call into
  `lib/agent/provider.ts` returns `null` on a missing key, a timeout, a rate
  limit, or a malformed reply, and the caller falls back to deterministic copy.
  Losing the model costs wording and nothing else.

## How the capacity score works

One number, 0–100, computed per person per day. Four weighted factors that sum
to exactly 100, so the UI can show the arithmetic instead of asking you to
trust it.

| Factor | Weight | Input | Normalisation |
| --- | --- | --- | --- |
| Recovery | 38 | WHOOP recovery percentage, 0–100 | Used directly as 0–1 |
| Sleep | 20 | Hours slept, plus minutes of sleep debt | 8h is the reference night; debt is charged on top, capped at 35% |
| Calendar load | 27 | Meeting minutes, and the longest unbroken run | Bottoms out at 330 minutes booked; a run past 120 minutes costs up to 30% more |
| Day strain | 15 | WHOOP day strain, 0–21 | Inverted — high strain, low capacity |

Recovery is weighted highest because it is the one signal that already accounts
for what the body did yesterday. Calendar load is second and carries a separate
penalty for unbroken runs, because a three-hour block of meetings does more
damage than three hours scattered across a day — that is the input people
recognise immediately when they see their own score.

Meetings are merged before they are counted, so an all-hands stacked with three
overlapping invites counts once. A gap of ten minutes or less is not a break; it
is a hallway.

The score lands in one of three bands:

| Band | Score | What the agent will place |
| --- | --- | --- |
| Depleted | under 40 | Nothing. Zero minutes, by design. |
| Steady | 40–67 | Up to 45 minutes |
| Primed | 68 and up | Up to 75 minutes |

A day with a meeting run of three hours or more loses another 15 minutes off
that ceiling even when the body is fine. The ceiling never drops below 25
minutes on a day that gets anything at all, because a shorter block is not a
real session.

## The scheduling guardrails

The scheduler finds real gaps and then refuses most of them. Four rules do it:

- **Decompression buffer.** A session cannot start until a set number of
  minutes have passed since the last work event: 120 when depleted, 60 when
  steady, 30 when primed. Time wedged against the end of a meeting gets skipped.
- **Daily budget.** The band's ceiling above is a hard cap. Depleted days get
  zero, which is the whole point.
- **Rest days.** At least two rest days per rolling week, per quest, counting
  blocks already on the books. The failure mode is burning out in week one and
  never coming back.
- **Weekly ceiling.** The weekly target a member set for themselves is treated
  as a ceiling the agent stays under, never a quota it fills. At most one block
  per day, at most three proposals at a time, nothing before 6am or ending after
  10pm.

Each proposed block carries its own rationale and its own risks as first-class
data, not as generated commentary — the score, the buffer that was cleared, the
minutes that were trimmed, the meeting run that will still be in your head.

## Why streaks are weekly

A daily streak punishes a normal life. One bad Tuesday and the counter you have
been protecting for a month reads zero, and the honest response to a zero is to
stop. SideQuest counts consecutive *weeks* containing at least one completed
session. A bad Tuesday is survivable, which is the entire point of a habit
meant to outlive its first month. The current week never breaks a streak just
for not having happened yet.

## Why there is no leaderboard

Because ranking people is the fastest way to make the person who is struggling
quit. Someone underwater at work does not need to see that four teammates are
ahead of them; they need one person to ask how it is going.

So SideQuest never ranks anybody and never posts a comparison. When a quest goes
quiet, the agent tells exactly one teammate, privately, and shows them the
signals behind it — days since the last session, the streak that ended, how
brutal that person's calendar has been. The ask is to send a message, not to
intervene. It is the one part of the product that behaves like a person rather
than a tool.

The shared feed still exists, because proof-of-progress from a coworker is
genuinely motivating. It is chronological and it has no score on it.

## What is simulated, and what would be real

Being straight about this: **the WHOOP telemetry and the calendar are both
generated.** No wearable and no calendar account are connected. Everything else
— the capacity arithmetic, the scheduler, the streaks, the nudges, the
persistence, the model call — is real code doing real work on synthetic input.

The simulation is confined to two types, and those two types are the adapter
boundary:

- **`DailySignal`** (`src/lib/domain/types.ts`) is shaped after the WHOOP daily
  cycle: recovery percentage, sleep hours, sleep debt, day strain, resting heart
  rate, HRV. It carries a `source` field that is `whoop-sim` today and `whoop`
  in production. Swapping in the real WHOOP API means writing one fetcher that
  returns this shape. The capacity engine does not change.
- **`CalendarEvent`** is the same story for Google or Microsoft Calendar: an
  owner, a kind, a start, an end, an attendee count. That is all the capacity
  engine reads.

The seed world is generated relative to the current moment from string seeds
rather than `Math.random()`, so the dataset is always current, and identical
between the server render and the client hydration.

In production the changes are narrow and boring, which is the point: OAuth for
WHOOP and the calendar provider, a background job that pulls each morning's
cycle, real per-user auth with RLS policies (the schema already has RLS on with
no anon policies, so the publishable key grants nothing today), and write-back
of accepted blocks to the member's actual calendar. None of that touches
`lib/domain`.

## Known edges

- The agent's prose is optional; its arithmetic is not. Every number a member
  sees came out of `computeCapacity` or `proposeWindows`, never out of a
  completion.
- The demo world is engineered around weekdays. The viewer's wall of a day is
  a weekday scenario, and the seeded calendar leaves weekends clear.
- There is one viewer. Auth, invites and multi-team are not built.
