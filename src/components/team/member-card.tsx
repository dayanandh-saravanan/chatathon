import {
  BookOpen,
  ChefHat,
  Compass,
  Footprints,
  Mountain,
  Music,
  Palette,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Avatar } from '@/components/avatar';
import { StreakBadge } from '@/components/quests/streak-badge';
import type {
  DayCapacity,
  Quest,
  QuestCategory,
  QuestStreak,
  TeamMember,
} from '@/lib/domain/types';
import { BAND_COPY } from '@/lib/domain/capacity';
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
 * means. It lands as a dot rather than a tinted chip: a depleted day is the
 * product working as intended, not a person failing, and a red block on
 * someone's face says the opposite.
 */
const BAND_DOT: Record<string, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  success: 'bg-success',
};

export function MemberCard({ member, quest, streak, capacity, isViewer }: MemberCardProps) {
  const band = BAND_COPY[capacity.band];
  const CategoryIcon = quest ? CATEGORY_ICON[quest.category] : Compass;
  const quiet = streak?.health === 'quiet';

  return (
    <article className="glass-panel shadow-soft hover-lift animate-smooth p-4">
      <div className="relative z-10 flex gap-3">
        <Avatar
          name={member.name}
          initials={member.initials}
          accent={member.accent}
          // Convention over configuration: the moment `/people/<handle>.jpg`
          // lands the face appears, and until then `Avatar` falls back to the
          // accent-tinted initials on its own.
          photoUrl={member.photoUrl ?? `/people/${member.handle}.jpg`}
          size="lg"
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="truncate text-[14px] font-semibold tracking-tight">{member.name}</h3>
            {isViewer ? (
              <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                You
              </span>
            ) : null}
          </div>
          <p className="truncate text-[12px] leading-5 text-muted-foreground">{member.role}</p>

          <p className="mt-1.5 flex min-w-0 items-start gap-1.5 text-[13px] leading-5">
            <CategoryIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {quest ? (
              <span className="line-clamp-2 font-medium text-foreground">{quest.title}</span>
            ) : (
              <span className="text-muted-foreground">No quest yet, and that is fine</span>
            )}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            {streak ? <StreakBadge streak={streak} showHealth={false} /> : null}
            <span
              title={`${band.label} — ${band.blurb}`}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              <span
                aria-hidden
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  BAND_DOT[band.tone] ?? 'bg-muted-foreground',
                )}
              />
              <span className="tabular-nums">{capacity.score}/100 today</span>
            </span>
          </div>

          {/* Quiet is an invitation, not a verdict, so it borrows the primary
              accent rather than the danger tone `HEALTH_COPY` carries. */}
          {quiet ? (
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              <span className="font-medium text-primary">Worth a check-in</span> ·{' '}
              {streak?.quietDays == null
                ? 'nothing logged since they set this up'
                : `${streak.quietDays} days since their last session`}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
