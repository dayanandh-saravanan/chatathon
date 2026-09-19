'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { clockTime, durationLabel, relativeDay } from '@/lib/domain/time';
import type { DateKey, QuestWindow } from '@/lib/domain/types';

type Pending = 'accepted' | 'declined' | null;

export interface ProposalCardProps {
  questWindow: QuestWindow;
  questTitle: string;
  todayKey: DateKey;
  /** Stagger index so a fresh batch of proposals arrives one after another. */
  index?: number;
}

/**
 * One proposal, as a row.
 *
 * Day, time, quest, fit, decide — all on one line. The first rationale bullet
 * is the summary; the rest of the reasoning and every risk stay one click away
 * so a week of proposals is a short list rather than a page of cards.
 */
export function ProposalCard({ questWindow, questTitle, todayKey, index = 0 }: ProposalCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(status: 'accepted' | 'declined') {
    setPending(status);
    setError(null);
    try {
      const res = await fetch(`/api/windows/${questWindow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      router.refresh();
    } catch {
      setError('That did not save. Try it again in a moment.');
      setPending(null);
    }
  }

  const busy = pending !== null;
  const [lead, ...rest] = questWindow.rationale;
  const hasMore = rest.length > 0 || questWindow.risks.length > 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.17, 0.67, 0.27, 1] }}
      className="rounded-2xl border border-border bg-card/70 shadow-soft animate-smooth hover:border-primary/30"
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 p-3">
        <div className="w-[136px] shrink-0">
          <p className="truncate text-[11px] font-medium tracking-wide text-primary uppercase">
            {relativeDay(questWindow.date, todayKey)}
          </p>
          {/* One line, always: a wrapped time range turns a row back into a card. */}
          <p className="text-[13px] font-semibold whitespace-nowrap tabular-nums">
            {clockTime(questWindow.start)} – {clockTime(questWindow.end)}
          </p>
        </div>

        {/* Shrinks to nothing on a narrow column so the row stays one line and
            the title truncates instead — the full text is in the tooltip. */}
        <div className="min-w-[140px] flex-1 sm:min-w-0">
          <p className="truncate text-[13px] font-medium" title={questTitle}>
            {questTitle}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={lead}>
            {durationLabel(questWindow.minutes)}
            {lead ? ` · ${lead}` : ''}
          </p>
        </div>

        <FitChip score={questWindow.score} />

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => decide('accepted')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground animate-smooth hover:opacity-90 disabled:opacity-60"
          >
            {pending === 'accepted' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Check className="size-3.5" aria-hidden />
            )}
            Accept
          </button>
          <button
            type="button"
            onClick={() => decide('declined')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted-foreground animate-smooth hover:text-foreground disabled:opacity-60"
          >
            {pending === 'declined' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <X className="size-3.5" aria-hidden />
            )}
            Not this week
          </button>
          {hasMore && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? 'Hide the reasoning' : 'Show the reasoning'}
              className="rounded-full p-1 text-muted-foreground animate-smooth hover:text-foreground"
            >
              <ChevronDown
                className={cn('size-4 animate-smooth', open && 'rotate-180')}
                aria-hidden
              />
            </button>
          )}
        </div>
      </div>

      {open && hasMore && (
        <div className="border-t border-border px-3 py-2.5">
          {rest.length > 0 && (
            <ul className="flex flex-col gap-1">
              {rest.map((line) => (
                <li key={line} className="flex gap-1.5 text-xs leading-snug text-foreground/75">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/70" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
          {questWindow.risks.length > 0 && (
            <ul className={cn('flex flex-col gap-1', rest.length > 0 && 'mt-1.5')}>
              {questWindow.risks.map((line) => (
                <li key={line} className="flex gap-1.5 text-xs leading-snug text-foreground/75">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-warning" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="px-3 pb-2.5 text-xs text-danger">{error}</p>}
    </motion.article>
  );
}

/** The agent's confidence in this window, shown rather than hidden. */
function FitChip({ score }: { score: number }) {
  return (
    <span
      className="shrink-0 rounded-full border border-border bg-white/70 px-2 py-0.5 text-[11px] font-medium tabular-nums"
      title="Fit out of 100: how confident the agent is that this window survives contact with your week"
    >
      {score}
      <span className="ml-1 text-muted-foreground">fit</span>
    </span>
  );
}
