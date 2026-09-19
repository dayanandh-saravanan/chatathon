'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { Moon, RotateCcw, Sparkles, X } from 'lucide-react';

import { Avatar } from '@/components/avatar';
import { CheerButton } from '@/components/feed/cheer-button';
import { PhotoTile } from '@/components/feed/photo-tile';
import { durationLabel } from '@/lib/domain/time';
import type { Post, PostKind, TeamMember, UserId } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/**
 * A post, opened. The photo gets the room it deserves; the words, the quest,
 * and who cheered sit beside it. Used from the feed grid and from the photo
 * ring on the quest studio, so it takes plain data rather than a feed entry.
 */

const MARKS: Partial<Record<PostKind, { icon: typeof Sparkles; label: string; className: string }>> = {
  milestone: { icon: Sparkles, label: 'Milestone', className: 'text-primary' },
  rest: { icon: Moon, label: 'Rest day', className: 'text-secondary' },
  restart: { icon: RotateCcw, label: 'Restarted', className: 'text-muted-foreground' },
};

export interface PostDialogProps {
  post: Post | null;
  author?: TeamMember;
  questTitle?: string;
  postedAgo?: string;
  viewerId: UserId;
  /** Everyone on the team, so cheers can be shown as faces rather than counts. */
  members?: TeamMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostDialog({
  post,
  author,
  questTitle,
  postedAgo,
  viewerId,
  members = [],
  open,
  onOpenChange,
}: PostDialogProps) {
  const mark = post ? MARKS[post.kind] : undefined;
  const byId = new Map(members.map((m) => [m.id, m]));
  const cheerers = post
    ? post.cheers.map((c) => ({ cheer: c, member: byId.get(c.userId) })).filter((c) => c.member)
    : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1100] bg-white/45 backdrop-blur-md" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[1101] w-[min(96vw,64rem)] -translate-x-1/2 -translate-y-1/2 focus:outline-none"
        >
          {post && author ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.17, 0.67, 0.27, 1] }}
              className="glass-layer-1 shadow-strong grid overflow-hidden rounded-3xl md:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)]"
            >
              <div className="relative bg-muted/60" style={{ minHeight: '22rem' }}>
                <PhotoTile
                  photoUrl={post.photoUrl}
                  glyph={post.glyph}
                  alt={`${author.name.split(' ')[0]}: ${post.body}`}
                  className="h-[min(78vh,42rem)] w-full"
                />
              </div>

              <div className="flex min-h-0 flex-col gap-4 p-5">
                <div className="flex items-start gap-3">
                  <Avatar
                    name={author.name}
                    initials={author.initials}
                    accent={author.accent}
                    photoUrl={author.photoUrl}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="truncate text-[14px] font-semibold text-foreground">
                      {author.name}
                    </Dialog.Title>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {author.role}
                      {postedAgo ? ` · ${postedAgo}` : ''}
                    </p>
                  </div>
                  <Dialog.Close
                    aria-label="Close"
                    className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground animate-smooth hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-4" />
                  </Dialog.Close>
                </div>

                {mark ? (
                  <span className={cn('inline-flex items-center gap-1 text-[12px] font-medium', mark.className)}>
                    <mark.icon className="size-3.5" />
                    {mark.label}
                    {post.milestoneTitle ? ` · ${post.milestoneTitle}` : ''}
                  </span>
                ) : null}

                <p className="text-[15px] leading-relaxed text-foreground">{post.body}</p>

                <div className="flex flex-wrap items-center gap-2">
                  {questTitle ? (
                    <span className="max-w-full truncate rounded-full bg-primary/10 px-2.5 py-1 text-[12px] font-medium text-primary">
                      {questTitle}
                    </span>
                  ) : null}
                  {post.minutes ? (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[12px] tabular-nums text-muted-foreground">
                      {durationLabel(post.minutes)}
                    </span>
                  ) : null}
                </div>

                <div className="mt-auto border-t border-border/70 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {cheerers.length > 0 ? (
                        <>
                          <span className="flex -space-x-2">
                            {cheerers.slice(0, 5).map(({ cheer, member }) => (
                              <span key={cheer.userId} className="rounded-full ring-2 ring-white">
                                <Avatar
                                  name={member!.name}
                                  initials={member!.initials}
                                  accent={member!.accent}
                                  photoUrl={member!.photoUrl}
                                  size="sm"
                                />
                              </span>
                            ))}
                          </span>
                          <span className="truncate text-[12px] text-muted-foreground">
                            {cheerers
                              .slice(0, 3)
                              .map(({ member }) => member!.name.split(' ')[0])
                              .join(', ')}
                            {cheerers.length > 3 ? ` and ${cheerers.length - 3} more` : ''}{' '}
                            cheered
                          </span>
                        </>
                      ) : (
                        <span className="text-[12px] text-muted-foreground">No cheers yet</span>
                      )}
                    </div>
                    <CheerButton postId={post.id} cheers={post.cheers} viewerId={viewerId} />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
