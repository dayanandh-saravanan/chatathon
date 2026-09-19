import { CapacityDial } from '@/components/today/capacity-dial';
import { CapacityFactors } from '@/components/today/capacity-factors';
import { NudgeList, type NudgePerson } from '@/components/today/nudge-list';
import { TodaysDecision, type TodaysBlock } from '@/components/today/todays-decision';
import { WeekStrip } from '@/components/today/week-strip';
import { getMembers, getNudges, getSnapshot } from '@/lib/data/service';
import { dayLabel, shortDate } from '@/lib/domain/time';
import type { UserId } from '@/lib/domain/types';

/**
 * The world is generated relative to "now", so a build-time prerender would
 * freeze the demo on whatever day the bundle was produced.
 */
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const snapshot = await getSnapshot();
  const nudges = await getNudges();
  const members = await getMembers();

  const todayKey = snapshot.today.date;
  const signal = snapshot.signals.find((s) => s.date === todayKey);

  const window = snapshot.windows.find(
    (w) => w.date === todayKey && (w.status === 'accepted' || w.status === 'completed'),
  );
  const block: TodaysBlock | null = window
    ? {
        id: window.id,
        questTitle:
          snapshot.quests.find((q) => q.id === window.questId)?.title ?? 'Your quest',
        start: window.start,
        end: window.end,
        minutes: window.minutes,
        rationale: window.rationale,
        risks: window.risks,
        completed: window.status === 'completed',
      }
    : null;

  const people: Record<UserId, NudgePerson> = Object.fromEntries(
    members.map((m) => [m.id, { name: m.name, initials: m.initials, accent: m.accent }]),
  );

  return (
    // The route-group shell already centres and pads the column; a second
    // container here only narrowed this page relative to the other four.
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {dayLabel(todayKey)} · {shortDate(todayKey)}
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight sm:text-4xl">Today</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {snapshot.member.name.split(' ')[0]}, your calendar and your body are both feeding one
            number. SideQuest only books hobby time behind it.
          </p>
        </div>

        <div className="glass-card flex items-center gap-3 rounded-2xl px-4 py-3">
          <span
            className="flex size-9 items-center justify-center rounded-xl text-xs font-semibold text-white"
            style={{ background: `hsl(${snapshot.member.accent})` }}
            aria-hidden
          >
            {snapshot.member.initials}
          </span>
          <div className="text-xs leading-snug">
            <p className="font-medium">{snapshot.member.name}</p>
            <p className="text-muted-foreground">
              {signal ? `WHOOP · ${Math.round(signal.recovery)}% recovery` : snapshot.member.role}
            </p>
          </div>
        </div>
      </header>

      <div className="mt-8 flex flex-col gap-6">
        <section className="glass-panel shadow-soft">
          <div className="relative z-10 grid gap-10 p-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
            <CapacityDial capacity={snapshot.today} />
            <CapacityFactors capacity={snapshot.today} />
          </div>
        </section>

        <TodaysDecision capacity={snapshot.today} block={block} />

        <WeekStrip days={snapshot.week} todayKey={todayKey} />

        <NudgeList nudges={nudges} people={people} />
      </div>
    </div>
  );
}
