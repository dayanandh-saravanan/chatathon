import { HEALTH_COPY } from '@/lib/domain/streaks';
import type { QuestStreak } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/**
 * Streaks are where a hobby app usually turns into a guilt machine, so the
 * stance is still here — it just costs one tooltip instead of two paragraphs.
 * Health is a coloured dot rather than a filled chip: in this palette purple is
 * the only accent, and a wide amber or red band on someone's quiet week reads
 * as a verdict.
 */

const DOT: Record<string, string> = {
  success: 'bg-success',
  primary: 'bg-primary',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

function weeksLabel(weeks: number): string {
  // Zero covers both a brand-new quest and one that has lapsed, so it must not
  // claim a streak that is not there.
  if (weeks <= 0) return 'No streak yet';
  return `${weeks}-week streak`;
}

interface StreakBadgeProps {
  streak: QuestStreak;
  /** The lead card names the health state; grids let the dot carry it. */
  showHealth?: boolean;
  className?: string;
}

export function StreakBadge({ streak, showHealth = true, className }: StreakBadgeProps) {
  const copy = HEALTH_COPY[streak.health];
  const quiet = streak.quietDays;

  const title = [
    copy.label,
    'Counted in weeks, not days — one missed Tuesday should not erase a month.',
    quiet !== null && quiet >= 7 ? `Nothing logged in ${quiet} days.` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', DOT[copy.tone] ?? DOT.primary)}
      />
      <span className="tabular-nums">{weeksLabel(streak.weeks)}</span>
      {showHealth ? (
        <>
          <span className="opacity-30" aria-hidden>
            ·
          </span>
          <span>{copy.label}</span>
        </>
      ) : null}
    </span>
  );
}
