'use client';

import { Moon, RotateCcw, Sparkles } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '@/components/avatar';
import { CheerButton } from '@/components/feed/cheer-button';
import { PostDialog } from '@/components/feed/post-dialog';
import { PhotoTile } from '@/components/feed/photo-tile';
import type { Post, PostKind, TeamMember, UserId } from '@/lib/domain/types';
import { durationLabel } from '@/lib/domain/time';
import { cn } from '@/lib/utils';

/**
 * One tile in the photo grid.
 *
 * The photo is the content; everything else is a single tight footer line
 * underneath it. Semantic state (milestone, rest, restart) is a small dot plus
 * a word, never a filled coloured band — a band would read as an alert and the
 * reference UI keeps colour down to an accent.
 */

interface KindMark {
  icon: typeof Sparkles;
  label: string;
  /** Text + dot colour only. */
  className: string;
}

const MARKS: Partial<Record<PostKind, KindMark>> = {
  milestone: { icon: Sparkles, label: 'Milestone', className: 'text-primary' },
  rest: { icon: Moon, label: 'Rest', className: 'text-secondary' },
  restart: { icon: RotateCcw, label: 'Restarted', className: 'text-muted-foreground' },
};

interface PostCardProps {
  post: Post;
  author: TeamMember;
  questTitle?: string;
  /** Pre-rendered on the server so every card agrees on what "now" was. */
  postedAgo: string;
  viewerId: UserId;
  /** For the opened view, so cheers show as faces. */
  members?: TeamMember[];
}

export function PostCard({ post, author, questTitle, postedAgo, viewerId, members }: PostCardProps) {
  const mark = MARKS[post.kind];
  const firstName = author.name.split(' ')[0];
  const [open, setOpen] = useState(false);

  return (
    <>
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-card',
        'shadow-soft hover-lift animate-smooth ease-liquid',
      )}
    >
      {/* The photo and the words open the post; the footer keeps its own controls. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${firstName}'s post`}
        className="block w-full cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <PhotoTile
          photoUrl={post.photoUrl}
          glyph={post.glyph}
          alt={`${firstName}: ${post.body}`}
          className="aspect-square w-full"
        />
      </button>

      <div className="flex flex-col gap-1.5 p-2.5">
        <div className="flex items-center gap-2">
          <Avatar
            name={author.name}
            initials={author.initials}
            accent={author.accent}
            photoUrl={author.photoUrl}
            size="sm"
          />
          <span className="truncate text-[13px] font-medium text-foreground">
            {firstName}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{postedAgo}</span>

          {mark ? (
            <span
              className={cn(
                'ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] font-medium',
                mark.className,
              )}
            >
              <mark.icon className="size-3" />
              {mark.label}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cursor-pointer text-left focus:outline-none"
        >
          <p className="line-clamp-2 text-[13px] leading-snug text-foreground/85">{post.body}</p>
        </button>

        <div className="flex items-center gap-2">
          {questTitle ? (
            <span className="min-w-0 truncate rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {questTitle}
            </span>
          ) : null}

          {post.minutes ? (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {durationLabel(post.minutes)}
            </span>
          ) : null}

          <span className="ml-auto shrink-0">
            <CheerButton postId={post.id} cheers={post.cheers} viewerId={viewerId} />
          </span>
        </div>
      </div>
    </article>

    <PostDialog
      post={post}
      author={author}
      questTitle={questTitle}
      postedAgo={postedAgo}
      viewerId={viewerId}
      members={members}
      open={open}
      onOpenChange={setOpen}
    />
    </>
  );
}
