'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

import type { Cheer, UserId } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/** The one emoji this button adds. Cheering is a toggle, not a reaction menu. */
const CHEER_EMOJI = '🔥';

interface CheerButtonProps {
  postId: string;
  cheers: Cheer[];
  viewerId: UserId;
}

/**
 * Cheers are a count on a single post and nothing else — they are never summed
 * per person or compared between people. There is no leaderboard here by
 * design: falling behind in public is the thing that makes people quit.
 */
export function CheerButton({ postId, cheers, viewerId }: CheerButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const serverCheer = cheers.find((c) => c.userId === viewerId)?.emoji ?? null;
  // `undefined` means "trust the server"; a string or null is an unconfirmed click.
  const [optimistic, setOptimistic] = React.useState<string | null | undefined>(undefined);
  const mine = optimistic === undefined ? serverCheer : optimistic;

  // Once the refresh lands, the server is authoritative again. Adjusting during
  // render rather than in an effect avoids a second render pass showing stale
  // optimistic state.
  const serverKey = `${serverCheer}:${cheers.length}`;
  const [syncedKey, setSyncedKey] = React.useState(serverKey);
  if (serverKey !== syncedKey) {
    setSyncedKey(serverKey);
    setOptimistic(undefined);
  }

  const others = cheers.filter((c) => c.userId !== viewerId);
  const count = others.length + (mine ? 1 : 0);

  async function toggle() {
    const next = mine ? null : CHEER_EMOJI;
    setOptimistic(next);
    setPending(true);
    try {
      const res = await fetch(`/api/posts/${postId}/cheer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji: next }),
      });
      if (!res.ok) throw new Error('cheer failed');
      router.refresh();
    } catch {
      setOptimistic(undefined);
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.button
      type="button"
      onClick={toggle}
      disabled={pending}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      aria-pressed={Boolean(mine)}
      aria-label={mine ? 'Remove your cheer' : 'Cheer this'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
        'animate-smooth ease-liquid disabled:opacity-60',
        mine
          ? 'border-primary/30 bg-primary/10 text-primary'
          : 'border-border bg-white/60 text-muted-foreground hover:border-primary/25 hover:text-foreground',
      )}
    >
      <span aria-hidden className={cn('text-[11px]', mine ? '' : 'opacity-50 grayscale')}>
        {CHEER_EMOJI}
      </span>
      {count > 0 ? (
        <span className="text-[11px] font-medium tabular-nums">{count}</span>
      ) : null}
    </motion.button>
  );
}
