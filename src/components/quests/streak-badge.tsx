import { CircleCheck, CircleDashed, Clock, Flame } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { HEALTH_COPY } from '@/lib/domain/streaks';
import type { QuestStreak } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/**
 * Streaks are the one place a hobby app usually turns into a guilt machine, so
 * the badge says out loud what it is counting. Weeks survive a bad Tuesday;
 * days do not, and a counter that resets on a bad Tuesday is the reason people
 * quit the thing they were enjoying.
 */

const TONE_CLASSES: Record<string, string> = {
  success: 'border-success/25 bg-success/10 text-success',
  primary: 'border-primary/25 bg-primary/10 text-primary',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  danger: 'border-danger/25 bg-danger/10 text-danger',
};

const HEALTH_ICON: Record<QuestStreak['health'], LucideIcon> = {
  thriving: Flame,
  steady: CircleCheck,
  slipping: CircleDashed,
  quiet: Clock,
};

function weeksLabel(weeks: number): string {
  // Zero covers both a brand-new quest and one that has lapsed, so it must not
  // claim a streak that is not there.
  if (weeks <= 0) return 'No streak yet';
  return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} running`;
}

interface StreakBadgeProps {
  streak: QuestStreak;
  /** The explainer only needs to appear once per screen. */
  showExplainer?: boolean;
  className?: string;
}

export function StreakBadge({ streak, showExplainer = true, className }: StreakBadgeProps) {
  const copy = HEALTH_COPY[streak.health];
  const Icon = HEALTH_ICON[streak.health];
  const tone = TONE_CLASSES[copy.tone] ?? TONE_CLASSES.primary;
  const goneQuiet = streak.quietDays !== null && streak.quietDays >= 7;

  return (
    <div className={cn('flex flex-col items-start gap-1.5 sm:items-end', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium shadow-soft',
          tone,
        )}
      >
        <Icon className="size-4" aria-hidden />
        <span>{weeksLabel(streak.weeks)}</span>
        <span className="opacity-40" aria-hidden>
          ·
        </span>
        <span className="opacity-90">{copy.label}</span>
      </span>

      {goneQuiet ? (
        <p className="max-w-[15rem] text-[11px] leading-snug text-muted-foreground sm:text-right">
          Nothing logged in {streak.quietDays} days. Picking it back up costs nothing.
        </p>
      ) : null}

      {showExplainer ? (
        <p className="max-w-[15rem] text-[11px] leading-snug text-muted-foreground sm:text-right">
          Counted in weeks, not days. One missed Tuesday should not erase a month.
        </p>
      ) : null}
    </div>
  );
}
