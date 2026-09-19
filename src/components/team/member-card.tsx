import {
  BookOpen,
  ChefHat,
  Compass,
  Flame,
  Footprints,
  Gauge,
  MessageCircle,
  Mountain,
  Music,
  Palette,
  Timer,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type {
  DayCapacity,
  Quest,
  QuestCategory,
  QuestStreak,
  TeamMember,
} from '@/lib/domain/types';
import { BAND_COPY } from '@/lib/domain/capacity';
import { durationLabel } from '@/lib/domain/time';
import { cn } from '@/lib/utils';

interface MemberCardProps {
  member: TeamMember;
  quest?: Quest;
  streak?: QuestStreak;
  capacity: DayCapacity;
  isViewer?: boolean;
}

const CATEGORY_ICON: Record<QuestCategory, LucideIcon> = {
  music: Music,
  fitness: Footprints,
  craft: Wrench,
  outdoors: Mountain,
  cooking: ChefHat,
  learning: BookOpen,
  art: Palette,
  other: Compass,
};

/**
 * `BAND_COPY` hands us a tone name so every surface agrees on what a band
 * means; the palette here keeps it soft. A depleted day is the product working
 * as intended, not a person failing, so it gets a tint rather than a red block.
 */
const BAND_STYLES: Record<string, string> = {
  danger: 'bg-danger/10 text-danger ring-danger/20',
  warning: 'bg-warning/15 text-warning ring-warning/25',
  success: 'bg-success/15 text-success ring-success/25',
};

const CHIP = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1';

export function MemberCard({ member, quest, streak, capacity, isViewer }: MemberCardProps) {
  const band = BAND_COPY[capacity.band];
  const CategoryIcon = quest ? CATEGORY_ICON[quest.category] : Compass;
  const quiet = streak?.health === 'quiet';

  return (
    <article className="glass-panel shadow-soft hover-lift animate-smooth flex h-full flex-col p-5">
      <div className="relative z-10 flex h-full flex-col">
        <header className="flex min-w-0 items-center gap-3">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold"
            // `accent` is a raw HSL triplet chosen per member, so the tint has
            // to be inline — Tailwind cannot generate a class for it.
            style={{
              backgroundColor: `hsl(${member.accent} / 0.14)`,
              color: `hsl(${member.accent})`,
              boxShadow: `inset 0 0 0 1px hsl(${member.accent} / 0.22)`,
            }}
            aria-hidden
          >
            {member.initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold tracking-tight">{member.name}</h3>
              {isViewer ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  You
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">{member.role}</p>
          </div>
        </header>

        {/* Two lines of headroom keeps one-line and two-line quest titles from
            knocking the chip rows out of alignment across a grid row. */}
        <div className="mt-5 flex min-h-11 items-start gap-2.5">
          <CategoryIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          {quest ? (
            <p className="text-sm font-medium leading-snug text-foreground">{quest.title}</p>
          ) : (
            <p className="text-sm leading-snug text-muted-foreground">
              No quest yet — nothing to report, and that is allowed.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {quest && streak ? (
            <>
              <span className={cn(CHIP, 'bg-muted/70 text-muted-foreground ring-border/70')}>
                <Flame className="size-3.5" aria-hidden />
                {streak.weeks === 0 ? 'No streak yet' : `${streak.weeks}-week streak`}
              </span>
              <span className={cn(CHIP, 'bg-muted/70 text-muted-foreground ring-border/70')}>
                <Timer className="size-3.5" aria-hidden />
                <span className="tabular-nums">
                  {durationLabel(streak.minutesThisWeek)} of{' '}
                  {durationLabel(quest.weeklyMinutesTarget)}
                </span>
                <span>this week</span>
              </span>
            </>
          ) : null}
          <span
            className={cn(
              CHIP,
              'font-medium',
              BAND_STYLES[band.tone] ?? 'bg-muted text-muted-foreground ring-border',
            )}
          >
            <Gauge className="size-3.5" aria-hidden />
            {band.label}
            <span className="tabular-nums opacity-75">{capacity.score}/100 today</span>
          </span>
        </div>

        {/* Quiet is an invitation, not a verdict, so it borrows the primary
            accent rather than the danger tone `HEALTH_COPY` carries. It sits
            last and hugs the card floor, so the cards beside it keep their
            chip rows aligned. */}
        {quiet ? (
          <div className="mt-auto pt-5">
            <div className="flex items-start gap-2.5 rounded-2xl bg-primary/8 px-3.5 py-3 ring-1 ring-primary/15">
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p className="text-xs leading-snug text-muted-foreground">
                <span className="font-medium text-primary">Worth a check-in.</span>{' '}
                {streak?.quietDays == null
                  ? 'No sessions logged since they set this up.'
                  : `${streak.quietDays} days since their last session.`}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
