import { CalendarClock, Moon, Sparkles } from 'lucide-react';

import { PlanControls } from '@/components/plan/plan-controls';
import { ProposalCard } from '@/components/plan/proposal-card';
import { WeekGrid } from '@/components/plan/week-grid';
import { getPlanningHorizon, getSnapshot, VIEWER_ID } from '@/lib/data/service';
import { BAND_COPY } from '@/lib/domain/capacity';
import { dateKey, dayLabel, durationLabel, relativeDay } from '@/lib/domain/time';
import type { CapacityBand, DayCapacity, QuestCategory } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/** The in-memory store is mutated by the API routes, so never cache this page. */
export const dynamic = 'force-dynamic';

/**
 * Quest titles are sentences — "Play three Bruno Mars songs start to finish".
 * A 90px calendar column cannot hold one, so blocks are labelled by category
 * and the full title lives on the proposal cards beside the grid.
 */
const CATEGORY_LABEL: Record<QuestCategory, string> = {
  music: 'Music',
  fitness: 'Training',
  craft: 'Making',
  outdoors: 'Outdoors',
  cooking: 'Cooking',
  learning: 'Studying',
  art: 'Art',
  other: 'SideQuest',
};

const BAND_CHIP: Record<CapacityBand, string> = {
  depleted: 'bg-danger/10 text-danger border-danger/20',
  steady: 'bg-warning/10 text-warning border-warning/25',
  primed: 'bg-success/10 text-success border-success/20',
};

export default async function PlanPage() {
  const [snapshot, horizon] = await Promise.all([
    getSnapshot(),
    getPlanningHorizon(VIEWER_ID),
  ]);

  const todayKey = dateKey(new Date());
  const weekKeys = new Set(snapshot.week.map((d) => d.date));

  const questTitles = Object.fromEntries(
    snapshot.quests.map((q) => [q.id, q.title]),
  ) as Record<string, string>;
  const gridLabels = Object.fromEntries(
    snapshot.quests.map((q) => [q.id, CATEGORY_LABEL[q.category]]),
  ) as Record<string, string>;

  const proposals = snapshot.windows
    .filter((w) => w.status === 'proposed')
    .sort((a, b) => a.start.localeCompare(b.start));
  const booked = snapshot.windows.filter(
    (w) => w.status === 'accepted' && weekKeys.has(w.date),
  );
  const outsideWeek = proposals.filter((w) => !weekKeys.has(w.date)).length;

  const bookedMinutes = booked.reduce((sum, w) => sum + w.minutes, 0);
  const openDays = horizon.filter((d) => d.dailyBudgetMinutes > 0);

  const questOptions = snapshot.quests
    .filter((q) => q.status === 'active')
    .map((q) => ({ id: q.id, title: q.title }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">The week ahead</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Every calendar tool schedules into free time. Free is not the same as capable — these
          are the windows where {snapshot.member.name.split(' ')[0]} can actually show up.
        </p>
      </header>

      <PlanControls quests={questOptions} />

      <HorizonStrip horizon={horizon} openDays={openDays.length} todayKey={todayKey} />

      <WeekGrid
        days={snapshot.week}
        events={snapshot.events}
        windows={snapshot.windows}
        questTitles={gridLabels}
        todayKey={todayKey}
      />

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">What the agent is proposing</h2>
            <p className="text-sm text-muted-foreground">
              Nothing here is on your calendar until you say yes.
            </p>
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {booked.length > 0
              ? `${booked.length} block${booked.length === 1 ? '' : 's'} on the books this week · ${durationLabel(bookedMinutes)} held`
              : 'Nothing on the books this week yet'}
          </p>
        </div>

        {proposals.length === 0 ? (
          <EmptyProposals />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {proposals.map((w, i) => (
                <ProposalCard
                  key={w.id}
                  questWindow={w}
                  questTitle={questTitles[w.questId] ?? 'SideQuest'}
                  todayKey={todayKey}
                  index={i}
                />
              ))}
            </div>
            {outsideWeek > 0 && (
              <p className="text-sm text-muted-foreground">
                {outsideWeek === 1
                  ? 'One of these lands after Sunday, so it is not drawn on the grid above.'
                  : `${outsideWeek} of these land after Sunday, so they are not drawn on the grid above.`}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/**
 * The ten days the scheduler is allowed to touch. Showing which ones it has
 * already ruled out is what makes a short list of proposals read as judgement
 * rather than as the agent running out of ideas.
 */
function HorizonStrip({
  horizon,
  openDays,
  todayKey,
}: {
  horizon: DayCapacity[];
  openDays: number;
  todayKey: string;
}) {
  return (
    <div className="glass-panel p-5">
      <div className="relative z-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CalendarClock className="size-4 text-primary" />
            Planning horizon
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {openDays === horizon.length
              ? `All ${horizon.length} days have some room`
              : `${openDays} of ${horizon.length} days have room · the rest are protected`}
          </p>
        </div>

        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {horizon.map((day) => {
            const closed = day.dailyBudgetMinutes === 0;
            return (
              <div
                key={day.date}
                title={day.headline}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1 rounded-2xl border p-2 text-center animate-smooth',
                  closed ? 'border-border bg-muted/50' : 'border-border bg-white/60 hover-lift',
                  day.date === todayKey && 'ring-1 ring-primary/25',
                )}
              >
                <span className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {relativeDay(day.date, todayKey) === 'Today' ? 'Today' : dayLabel(day.date)}
                </span>
                <span
                  className={cn(
                    'w-full truncate rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                    BAND_CHIP[day.band],
                  )}
                >
                  {day.score}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {closed ? 'protected' : durationLabel(day.dailyBudgetMinutes)}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Today:</span>{' '}
          {BAND_COPY[horizon[0]?.band ?? 'steady'].blurb}
        </p>
      </div>
    </div>
  );
}

function EmptyProposals() {
  return (
    <div className="glass-card flex flex-col items-start gap-3 rounded-2xl p-6 sm:flex-row sm:items-center">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">No open proposals</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a quest above and ask the agent to plan. It will look at the next ten days and
          hand back two or three blocks — or tell you, plainly, that this week has no room.
        </p>
      </div>
      <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground lg:flex">
        <Moon className="size-3.5" />
        An empty plan is a real answer
      </span>
    </div>
  );
}
