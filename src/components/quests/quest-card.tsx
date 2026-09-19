import {
  BookOpen,
  CalendarDays,
  ChefHat,
  Clock,
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

/**
 * Category colours come from the chart tokens rather than new hex values, so a
 * quest chip can never drift away from the rest of the palette.
 */
const CATEGORY: Record<QuestCategory, { label: string; icon: LucideIcon; token: string }> = {
  music: { label: 'Music', icon: Music, token: '--chart-1' },
  fitness: { label: 'Fitness', icon: Dumbbell, token: '--success' },
  craft: { label: 'Craft', icon: Hammer, token: '--warning' },
  outdoors: { label: 'Outdoors', icon: Mountain, token: '--chart-3' },
  cooking: { label: 'Cooking', icon: ChefHat, token: '--chart-4' },
  learning: { label: 'Learning', icon: BookOpen, token: '--secondary' },
  art: { label: 'Art', icon: Palette, token: '--chart-5' },
  other: { label: 'Side quest', icon: Sparkles, token: '--chart-2' },
};

/** How much of the bar sits past the ceiling, so the ceiling is a line you can see room beyond. */
const CEILING_STOP = 80;

function MetaChip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}

/**
 * The weekly target is drawn as a ceiling, not a goal line. Every other habit
 * tracker draws a bar you are failing to fill; this one draws a bar with a lid
 * on it, because the agent's job is to stop booking at that line rather than to
 * push you past it.
 */
function CeilingBar({ quest, streak }: { quest: Quest; streak: QuestStreak }) {
  const target = quest.weeklyMinutesTarget;
  const logged = streak.minutesThisWeek;
  const barMax = target * (100 / CEILING_STOP);
  const fill = clamp(barMax > 0 ? (logged / barMax) * 100 : 0, 0, 100);
  const over = logged > target;

  return (
    <div>
      {/* The label is anchored over the cap rather than at the end of the track,
          so nobody reads the track's end as the ceiling. */}
      <div className="flex">
        <div className="flex justify-end" style={{ width: `${CEILING_STOP}%` }}>
          <span className="translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-muted-foreground">
            Ceiling {durationLabel(target)}
          </span>
        </div>
      </div>

      <div className="relative mt-1 h-2 w-full">
        <div className="absolute inset-0 overflow-hidden rounded-full bg-border">
          <div
            aria-hidden
            className="absolute inset-y-0 right-0"
            style={{
              width: `${100 - CEILING_STOP}%`,
              backgroundImage:
                'repeating-linear-gradient(135deg, hsl(var(--muted-foreground) / 0.25) 0 1.5px, transparent 1.5px 6px)',
            }}
          />
          <div
            className="gradient-purple-blue absolute inset-y-0 left-0 rounded-full"
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
          className="absolute -top-1 -bottom-1 w-[2px] -translate-x-1/2 rounded-full bg-foreground/60"
          style={{ left: `${CEILING_STOP}%` }}
        />
      </div>

      <p className="mt-2.5 text-sm text-foreground">
        <span className="font-medium">{durationLabel(logged)}</span>
        <span className="text-muted-foreground">
          {' '}
          this week across {streak.sessionsThisWeek}{' '}
          {streak.sessionsThisWeek === 1 ? 'session' : 'sessions'}
        </span>
      </p>

      {/* `--warning` is a fill colour in this system — as 12px text on the
          off-white page it lands near 2:1, so the over-ceiling sentence borrows
          the readable text token and the bar above it carries the amber. */}
      <p className={cn('mt-1 text-xs leading-snug', over ? 'text-foreground/80' : 'text-muted-foreground')}>
        {over
          ? `You are ${durationLabel(logged - target)} past your own ceiling. Nothing more gets booked this week.`
          : 'A ceiling, not a quota. SideQuest stops booking at this line even on a good week.'}
      </p>
    </div>
  );
}

interface QuestCardProps {
  quest: Quest;
  streak?: QuestStreak;
  /** The weeks-not-days explainer only earns its space once per page. */
  showStreakExplainer?: boolean;
}

export function QuestCard({ quest, streak, showStreakExplainer = true }: QuestCardProps) {
  const category = CATEGORY[quest.category];
  const CategoryIcon = category.icon;

  return (
    <article className="glass-panel hover-lift p-6 sm:p-7">
      <div className="relative z-10">
        {/* Stacked on narrow screens: side by side, the badge's explainer starves
            the title down to one word per line. */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 sm:flex-1">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: `hsl(var(${category.token}) / 0.12)`,
                color: `hsl(var(${category.token}))`,
              }}
            >
              <CategoryIcon className="size-3.5" aria-hidden />
              {category.label}
            </span>

            <h2 className="mt-3 text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
              {quest.title}
            </h2>
          </div>

          {streak ? (
            <StreakBadge
              streak={streak}
              showExplainer={showStreakExplainer}
              className="sm:shrink-0"
            />
          ) : null}
        </header>

        {/* Their own sentence, never rewritten by the agent — it is the only
            thing on this card that survives a bad week. */}
        <blockquote className="mt-4 border-l-2 border-primary/30 pl-4 text-[15px] italic leading-relaxed text-muted-foreground">
          {quest.why}
        </blockquote>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <MetaChip icon={CalendarDays}>Target {shortDate(quest.targetDate)}</MetaChip>
          <MetaChip icon={Clock}>{durationLabel(quest.sessionMinutes)} sessions</MetaChip>
        </div>

        <div className="mt-6">
          <CeilingBar quest={quest} streak={streak ?? emptyStreak(quest)} />
        </div>

        {quest.milestones.length > 0 ? (
          <div className="mt-6 border-t border-border pt-6">
            <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              The ladder
            </h3>
            <MilestoneLadder milestones={quest.milestones} />
          </div>
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
