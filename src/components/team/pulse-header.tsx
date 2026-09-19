import type { TeamPulse } from '@/lib/domain/types';
import { durationLabel, shortDate } from '@/lib/domain/time';
import { cn } from '@/lib/utils';

interface PulseHeaderProps {
  pulse: TeamPulse;
  /**
   * Every quest a streak was computed for. `questsThriving` and `questsQuiet`
   * are counted against this exact set, so the tiles print a denominator
   * instead of a bare count that reads like a total.
   */
  questsTracked: number;
}

interface Tile {
  key: string;
  label: string;
  value: string;
  /** What the number is measured against, and over what span. */
  scope: string;
  /** Semantic state is a dot, never a filled band. */
  dot?: string;
}

export function PulseHeader({ pulse, questsTracked }: PulseHeaderProps) {
  const delta = pulse.minutesReclaimed - pulse.minutesLastWeek;
  const lastWeekLabel = durationLabel(pulse.minutesLastWeek);

  // The current week is still running while last week is closed, so the
  // comparison is only honest if both spans are stated out loud.
  const deltaFoot =
    delta === 0
      ? `level with last week's full ${lastWeekLabel}`
      : delta > 0
        ? `${durationLabel(delta)} past last week's full ${lastWeekLabel}`
        : `${durationLabel(-delta)} short of last week's full ${lastWeekLabel}`;

  const tiles: Tile[] = [
    {
      key: 'reclaimed',
      label: 'Time reclaimed',
      value: durationLabel(pulse.minutesReclaimed),
      scope: `this week across ${pulse.memberCount} people · ${deltaFoot}`,
    },
    {
      key: 'participating',
      label: 'Took part',
      value: `${pulse.participating} of ${pulse.memberCount}`,
      scope: 'people with a finished session this week',
    },
    {
      key: 'thriving',
      label: 'Quests thriving',
      value: `${pulse.questsThriving} of ${questsTracked}`,
      scope: 'tracked quests at 80%+ of their own target, this week',
      dot: 'bg-success',
    },
    {
      key: 'quiet',
      label: 'Quests gone quiet',
      value: `${pulse.questsQuiet} of ${questsTracked}`,
      scope: 'tracked quests with no session in 10+ days, or none logged yet',
      dot: 'bg-warning',
    },
  ];

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[13px] font-medium tracking-tight text-foreground">Team pulse</h2>
        <p className="text-[12px] text-muted-foreground">
          Week of {shortDate(pulse.weekStart)}, still running · capacity today averages{' '}
          <span className="tabular-nums text-foreground">{pulse.averageCapacity}/100</span> across{' '}
          {pulse.memberCount}
        </p>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="shadow-soft rounded-2xl border border-border bg-card/80 p-4 backdrop-blur-xl"
          >
            <p className="flex items-center gap-1.5 text-[12px] leading-5 text-muted-foreground">
              {tile.dot ? (
                <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', tile.dot)} />
              ) : null}
              {tile.label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
              {tile.value}
            </p>
            <p className="mt-0.5 text-[12px] leading-[1.35] text-muted-foreground">{tile.scope}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
