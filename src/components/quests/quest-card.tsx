import {
  BookOpen,
  ChefHat,
  Dumbbell,
  Hammer,
  Mountain,
  Music,
  Palette,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { MilestoneLadder } from '@/components/quests/milestone-ladder';
import { StreakBadge } from '@/components/quests/streak-badge';
import { clamp, durationLabel, shortDate } from '@/lib/domain/time';
import type { Quest, QuestCategory, QuestStreak } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

const CATEGORY: Record<QuestCategory, { label: string; icon: LucideIcon }> = {
  music: { label: 'Music', icon: Music },
  fitness: { label: 'Fitness', icon: Dumbbell },
  craft: { label: 'Craft', icon: Hammer },
  outdoors: { label: 'Outdoors', icon: Mountain },
  cooking: { label: 'Cooking', icon: ChefHat },
  learning: { label: 'Learning', icon: BookOpen },
  art: { label: 'Art', icon: Palette },
  other: { label: 'Side quest', icon: Sparkles },
};

/** Where the ceiling sits on the track, so there is visible room beyond it. */
const CEILING_STOP = 80;

/**
 * The weekly target is drawn as a ceiling, not a goal line. Every other habit
 * tracker draws a bar you are failing to fill; this one draws a bar with a lid,
 * because the agent's job is to stop booking at that line rather than push you
 * past it. One caption line carries the numbers with their scope.
 */
function CeilingBar({ quest, streak }: { quest: Quest; streak: QuestStreak }) {
  const target = quest.weeklyMinutesTarget;
  const logged = streak.minutesThisWeek;
  const barMax = target * (100 / CEILING_STOP);
  const fill = clamp(barMax > 0 ? (logged / barMax) * 100 : 0, 0, 100);
  const over = logged > target;
  const sessions = `${streak.sessionsThisWeek} ${streak.sessionsThisWeek === 1 ? 'session' : 'sessions'}`;

  return (
    <div>
      <div className="relative h-1.5 w-full">
        <div className="absolute inset-0 overflow-hidden rounded-full bg-border">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${Math.min(fill, CEILING_STOP)}%` }}
          />
          {over ? (
            <div
              className="absolute inset-y-0 rounded-r-full bg-warning"
              style={{ left: `${CEILING_STOP}%`, width: `${Math.max(0, fill - CEILING_STOP)}%` }}
            />
          ) : null}
        </div>
        {/* Drawn outside the clipped track so it reads as a lid on the bar. */}
        <span
          aria-hidden
          className="absolute -top-1 -bottom-1 w-[2px] -translate-x-1/2 rounded-full bg-foreground/50"
          style={{ left: `${CEILING_STOP}%` }}
        />
      </div>

      <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">{durationLabel(logged)}</span>{' '}
        of a <span className="tabular-nums">{durationLabel(target)}</span> weekly ceiling,{' '}
        {sessions} this week
        {over ? ' — nothing more gets booked' : null}
      </p>
    </div>
  );
}

interface QuestCardProps {
  quest: Quest;
  streak?: QuestStreak;
  /** Paused and finished quests get the title and the why, nothing else. */
  dense?: boolean;
}

export function QuestCard({ quest, streak, dense = false }: QuestCardProps) {
  const category = CATEGORY[quest.category];
  const CategoryIcon = category.icon;

  return (
    <article
      className={cn(
        'glass-panel animate-smooth',
        dense ? 'p-4' : 'hover-lift p-5',
      )}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              className={cn(
                'truncate font-semibold leading-tight tracking-tight text-foreground',
                dense ? 'text-[15px]' : 'text-lg',
              )}
            >
              {quest.title}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <CategoryIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {category.label} · {durationLabel(quest.sessionMinutes)} sessions · target{' '}
                {shortDate(quest.targetDate)}
              </span>
            </p>
          </div>

          {streak ? (
            <StreakBadge streak={streak} showHealth={!dense} className="mt-0.5 shrink-0" />
          ) : null}
        </div>

        {/* Their own sentence, never rewritten by the agent — it is the only
            thing on this card that survives a bad week. */}
        <p className="mt-3 line-clamp-1 border-l-2 border-primary/25 pl-3 text-[13px] italic leading-5 text-muted-foreground">
          {quest.why}
        </p>

        {!dense ? (
          <>
            <div className="mt-4">
              <CeilingBar quest={quest} streak={streak ?? emptyStreak(quest)} />
            </div>

            {quest.milestones.length > 0 ? (
              <MilestoneLadder
                milestones={quest.milestones}
                collapsible
                className="mt-4 border-t border-border pt-3"
              />
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

/** A quest created seconds ago has no streak yet; the bar should still render. */
function emptyStreak(quest: Quest): QuestStreak {
  return {
    questId: quest.id,
    weeks: 0,
    quietDays: null,
    minutesThisWeek: 0,
    minutesLastWeek: 0,
    sessionsThisWeek: 0,
    adherence: 0,
    health: 'steady',
  };
}
