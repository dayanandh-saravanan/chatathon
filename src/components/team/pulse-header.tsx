import { CalendarDays, Moon, Sparkles, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { TeamPulse } from '@/lib/domain/types';
import { durationLabel, shortDate } from '@/lib/domain/time';
import { cn } from '@/lib/utils';

interface PulseHeaderProps {
  pulse: TeamPulse;
  /**
   * Every quest a streak was computed for. `questsThriving` and `questsQuiet`
   * are counted against this exact set, so the tiles can print a denominator
   * instead of a bare count that reads like a total.
   */
  questsTracked: number;
}

interface Tile {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string;
  /** What the number is measured against, and over what span. */
  scope: string;
  foot: string;
  footIcon?: LucideIcon;
  tone: 'primary' | 'secondary' | 'success' | 'warning';
}

const TONE_STYLES: Record<Tile['tone'], { chip: string; value: string }> = {
  primary: { chip: 'bg-primary/10 text-primary', value: 'text-foreground' },
  secondary: { chip: 'bg-secondary/10 text-secondary', value: 'text-foreground' },
  success: { chip: 'bg-success/10 text-success', value: 'text-foreground' },
  warning: { chip: 'bg-warning/12 text-warning', value: 'text-foreground' },
};

export function PulseHeader({ pulse, questsTracked }: PulseHeaderProps) {
  const delta = pulse.minutesReclaimed - pulse.minutesLastWeek;
  const lastWeekLabel = durationLabel(pulse.minutesLastWeek);

  // The current week is still running while last week is closed, so the
  // comparison is only honest if both spans are stated out loud.
  const deltaFoot =
    delta === 0
      ? `Level with last week's full ${lastWeekLabel}`
      : delta > 0
        ? `${durationLabel(delta)} past last week's full ${lastWeekLabel}`
        : `${durationLabel(-delta)} short of last week's full ${lastWeekLabel}`;

  const notYet = pulse.memberCount - pulse.participating;

  const tiles: Tile[] = [
    {
      key: 'reclaimed',
      icon: CalendarDays,
      label: 'Time reclaimed',
      value: durationLabel(pulse.minutesReclaimed),
      scope: `Across ${pulse.memberCount} people, week of ${shortDate(pulse.weekStart)} so far`,
      foot: deltaFoot,
      footIcon: delta >= 0 ? TrendingUp : TrendingDown,
      tone: 'primary',
    },
    {
      key: 'participating',
      icon: Users,
      label: 'Took part',
      value: `${pulse.participating}/${pulse.memberCount}`,
      scope: 'People with a finished session this week',
      foot:
        notYet === 0
          ? 'Everyone has been out there this week'
          : `${notYet} of ${pulse.memberCount} have not logged one yet this week`,
      tone: 'secondary',
    },
    {
      key: 'thriving',
      icon: Sparkles,
      label: 'Quests thriving',
      value: `${pulse.questsThriving}/${questsTracked}`,
      scope: `Of ${questsTracked} tracked quests, this week`,
      foot: 'At or past 80% of the target its owner set',
      tone: 'success',
    },
    {
      key: 'quiet',
      icon: Moon,
      label: 'Quests gone quiet',
      value: `${pulse.questsQuiet}/${questsTracked}`,
      scope: `Of ${questsTracked} tracked quests, as of today`,
      foot: 'No session in 10 days or more, or none logged yet',
      tone: 'warning',
    },
  ];

  return (
    <section className="glass-panel shadow-soft p-6 sm:p-7">
      <div className="relative z-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Team pulse</h2>
            <p className="text-sm text-muted-foreground">
              Week of {shortDate(pulse.weekStart)}, still running.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Capacity today averages{' '}
            <span className="font-medium text-foreground">{pulse.averageCapacity}/100</span> across
            the {pulse.memberCount} of us.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            const FootIcon = tile.footIcon;
            const tone = TONE_STYLES[tile.tone];
            return (
              <div
                key={tile.key}
                // `.card-clean` is unlayered CSS, so it beat the Tailwind
                // `border-border/60` this used to carry and the tiles read as
                // flat white rectangles inside the glass panel. `glass-card` is
                // the frosted treatment every other nested card here uses, and
                // its border actually lands.
                className="glass-card shadow-soft flex flex-col gap-3 rounded-2xl p-5"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-xl',
                      tone.chip,
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {tile.label}
                  </span>
                </div>

                <div>
                  <p
                    className={cn(
                      'text-3xl font-semibold tabular-nums tracking-tight',
                      tone.value,
                    )}
                  >
                    {tile.value}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">{tile.scope}</p>
                </div>

                <p className="mt-auto flex items-start gap-1.5 text-xs leading-snug text-muted-foreground/90">
                  {FootIcon ? <FootIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : null}
                  <span>{tile.foot}</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
