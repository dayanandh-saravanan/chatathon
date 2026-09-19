import { CapacitySummary, type TodayBlock } from '@/components/plan/capacity-summary';
import { NudgeBand, type NudgePerson } from '@/components/plan/nudge-band';
import { PlanControls } from '@/components/plan/plan-controls';
import { ProposalCard } from '@/components/plan/proposal-card';
import { WeekGrid } from '@/components/plan/week-grid';
import { getMembers, getNudges, getSnapshot, VIEWER_ID } from '@/lib/data/service';
import { dateKey, dayLabel, durationLabel, shortDate } from '@/lib/domain/time';
import type { QuestCategory, UserId } from '@/lib/domain/types';

/**
 * Plan — today and the week ahead on one page.
 *
 * Three bands: what you have left today, where it sits in the week, and what
 * the agent wants to do about it. Today used to be its own route; merging it
 * here is what makes the capacity number and the calendar argue on the same
 * screen instead of two clicks apart.
 *
 * The in-memory store is mutated by the API routes, so never cache this page.
 */
export const dynamic = 'force-dynamic';

/**
 * Quest titles are sentences — "Play three Bruno Mars songs start to finish".
 * A calendar column cannot hold one, so blocks are labelled by category and
 * the full title lives on the proposal rows below the grid.
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

export default async function PlanPage() {
  const [snapshot, nudges, members] = await Promise.all([
    getSnapshot(VIEWER_ID),
    getNudges(),
    getMembers(),
  ]);

  const todayKey = dateKey(new Date());
  const weekKeys = new Set(snapshot.week.map((d) => d.date));
  const signal = snapshot.signals.find((s) => s.date === snapshot.today.date) ?? null;

  const questTitles = Object.fromEntries(
    snapshot.quests.map((q) => [q.id, q.title]),
  ) as Record<string, string>;
  const gridLabels = Object.fromEntries(
    snapshot.quests.map((q) => [q.id, CATEGORY_LABEL[q.category]]),
  ) as Record<string, string>;

  const todaysWindow = snapshot.windows.find(
    (w) =>
      w.date === snapshot.today.date &&
      (w.status === 'accepted' || w.status === 'completed'),
  );
  const block: TodayBlock | null = todaysWindow
    ? {
        id: todaysWindow.id,
        questTitle: questTitles[todaysWindow.questId] ?? 'Your quest',
        start: todaysWindow.start,
        end: todaysWindow.end,
        minutes: todaysWindow.minutes,
        completed: todaysWindow.status === 'completed',
      }
    : null;

  const proposals = snapshot.windows
    .filter((w) => w.status === 'proposed')
    .sort((a, b) => a.start.localeCompare(b.start));
  const booked = snapshot.windows.filter(
    (w) => w.status === 'accepted' && weekKeys.has(w.date),
  );
  const outsideWeek = proposals.filter((w) => !weekKeys.has(w.date)).length;
  const bookedMinutes = booked.reduce((sum, w) => sum + w.minutes, 0);

  const questOptions = snapshot.quests
    .filter((q) => q.status === 'active')
    .map((q) => ({ id: q.id, title: q.title }));

  const people: Record<UserId, NudgePerson> = Object.fromEntries(
    members.map((m) => [
      m.id,
      { name: m.name, initials: m.initials, accent: m.accent, photoUrl: m.photoUrl },
    ]),
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Plan</h1>
        <p className="text-xs text-muted-foreground">
          {dayLabel(todayKey)} {shortDate(todayKey)} · {snapshot.member.name.split(' ')[0]}
        </p>
      </header>

      <CapacitySummary capacity={snapshot.today} block={block} signal={signal} />

      <WeekGrid
        days={snapshot.week}
        events={snapshot.events}
        windows={snapshot.windows}
        questTitles={gridLabels}
        todayKey={todayKey}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_288px] lg:gap-5">
        <section className="flex flex-col gap-2.5">
          <PlanControls quests={questOptions} />

          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[13px] font-semibold">
              Proposed
              <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
                {proposals.length}
              </span>
            </h2>
            <p className="text-xs text-muted-foreground tabular-nums">
              {booked.length > 0
                ? `${booked.length} on the books this week · ${durationLabel(bookedMinutes)}`
                : 'Nothing on the books this week'}
            </p>
          </div>

          {proposals.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
              No open proposals. Pick a quest and re-plan — an empty week is a real answer.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
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
                <p className="text-xs text-muted-foreground tabular-nums">
                  {outsideWeek} of {proposals.length} land{outsideWeek === 1 ? 's' : ''} after
                  Sunday, so {outsideWeek === 1 ? 'it is' : 'they are'} not on the grid above.
                </p>
              )}
            </>
          )}
        </section>

        <NudgeBand nudges={nudges} people={people} />
      </div>
    </div>
  );
}
