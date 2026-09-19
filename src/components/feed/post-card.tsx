import { Clock, Moon, RotateCcw, Sparkles } from 'lucide-react';

import { CheerButton } from '@/components/feed/cheer-button';
import type { Post, PostKind, TeamMember, UserId } from '@/lib/domain/types';
import { durationLabel } from '@/lib/domain/time';
import { cn } from '@/lib/utils';

interface KindTreatment {
  /** Wrapped in a gradient hairline — reserved for genuine milestones. */
  celebrate: boolean;
  chip?: { icon: typeof Sparkles; label: string; className: string };
  /** Overrides the accent-tinted tile so rest days read cool rather than loud. */
  tile?: string;
}

const TREATMENTS: Record<PostKind, KindTreatment> = {
  progress: { celebrate: false },
  milestone: {
    celebrate: true,
    chip: {
      icon: Sparkles,
      label: 'Milestone',
      className: 'border-primary/25 bg-primary/10 text-primary',
    },
  },
  rest: {
    celebrate: false,
    chip: {
      icon: Moon,
      label: 'Rest day',
      className: 'border-secondary/25 bg-secondary/10 text-secondary',
    },
    tile:
      'linear-gradient(135deg, hsl(var(--secondary) / 0.20) 0%, hsl(var(--muted)) 58%, hsl(var(--secondary) / 0.10) 100%)',
  },
  restart: {
    celebrate: false,
    chip: {
      icon: RotateCcw,
      label: 'Picked it back up',
      className: 'border-warning/30 bg-warning/10 text-warning',
    },
  },
};

interface PostCardProps {
  post: Post;
  author: TeamMember;
  questTitle?: string;
  /** Pre-rendered on the server so every card agrees on what "now" was. */
  postedAgo: string;
  viewerId: UserId;
}

export function PostCard({ post, author, questTitle, postedAgo, viewerId }: PostCardProps) {
  const treatment = TREATMENTS[post.kind];
  const Chip = treatment.chip;

  const tileBackground =
    treatment.tile ??
    `linear-gradient(135deg, hsl(${author.accent} / 0.38) 0%, hsl(${author.accent} / 0.14) 55%, hsl(var(--secondary) / 0.20) 100%)`;

  const card = (
    <article className="glass-panel rounded-3xl p-5 shadow-soft sm:p-6">
      <div className="relative z-10 flex flex-col gap-4">
        <header className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold ring-1 ring-black/[0.04]"
            style={{
              backgroundColor: `hsl(${author.accent} / 0.16)`,
              color: `hsl(${author.accent})`,
            }}
          >
            {author.initials}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{author.name}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{postedAgo}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{author.role}</p>
          </div>

          {Chip ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                Chip.className,
              )}
            >
              <Chip.icon className="size-3.5" />
              {Chip.label}
            </span>
          ) : null}
        </header>

        {questTitle ? (
          <span className="inline-flex w-fit max-w-full items-center rounded-full border border-border bg-white/55 px-3 py-1 text-xs text-muted-foreground">
            <span className="truncate">{questTitle}</span>
          </span>
        ) : null}

        {/* Glyph stands in for the photo a real post would carry. */}
        <div
          className="relative grid h-40 place-items-center overflow-hidden rounded-2xl ring-1 ring-black/[0.04] sm:h-44"
          style={{ backgroundImage: tileBackground }}
        >
          <span className="pointer-events-none absolute size-44 rounded-full bg-white/45 blur-2xl" />
          <span
            aria-hidden
            className="relative text-7xl drop-shadow-[0_8px_20px_rgba(71,85,105,0.22)] sm:text-8xl"
          >
            {post.glyph}
          </span>
          <span className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-white/40 to-transparent" />
        </div>

        <p className="text-[0.9375rem] leading-relaxed text-foreground/90">{post.body}</p>

        <div className="flex flex-wrap items-center gap-2">
          <CheerButton postId={post.id} cheers={post.cheers} viewerId={viewerId} />

          {post.minutes ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/55 px-3 py-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {durationLabel(post.minutes)}
            </span>
          ) : null}

          {post.milestoneTitle ? (
            <span className="inline-flex max-w-full items-center rounded-full border border-primary/20 bg-primary/[0.07] px-3 py-1.5 text-xs font-medium text-primary">
              <span className="truncate">{post.milestoneTitle}</span>
            </span>
          ) : null}

          {post.kind === 'rest' && !post.minutes ? (
            <span className="text-xs text-muted-foreground">Counts the same as a session.</span>
          ) : null}
        </div>
      </div>
    </article>
  );

  if (!treatment.celebrate) return card;

  return (
    <div className="gradient-purple-blue rounded-[calc(1.5rem+2px)] p-[2px] shadow-medium">
      {/* The panel is translucent, so the gradient needs an opaque backing or it
          floods the whole card instead of reading as a hairline. */}
      <div className="rounded-3xl bg-background">{card}</div>
    </div>
  );
}
