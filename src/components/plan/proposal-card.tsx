'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, Loader2, TriangleAlert, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
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

export function ProposalCard({ questWindow, questTitle, todayKey, index = 0 }: ProposalCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending>(null);
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

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: [0.17, 0.67, 0.27, 1] }}
      className="glass-card hover-lift flex flex-col gap-4 rounded-2xl p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-primary uppercase">
            {relativeDay(questWindow.date, todayKey)}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold tabular-nums">
            {clockTime(questWindow.start)} – {clockTime(questWindow.end)}
          </h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {durationLabel(questWindow.minutes)} · {questTitle}
          </p>
        </div>
        <FitChip score={questWindow.score} />
      </header>

      <section>
        <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          Why this window
        </h4>
        <ul className="mt-2 space-y-1.5">
          {questWindow.rationale.map((line) => (
            <li key={line} className="flex gap-2 text-sm leading-snug">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/70" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      {questWindow.risks.length > 0 && (
        <section>
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-warning uppercase">
            <TriangleAlert className="size-3" />
            What could go wrong
          </h4>
          {/* The amber lives in the heading and the bullets. On this off-white
              background `--warning` as body text sits near 2:1 against the page,
              which is not readable at 14px, so the sentences stay on the text
              token and the colour does the signalling. */}
          <ul className="mt-2 space-y-1.5">
            {questWindow.risks.map((line) => (
              <li key={line} className="flex gap-2 text-sm leading-snug text-foreground/75">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-warning" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <footer className="mt-auto flex items-center gap-2 pt-1">
        <Button
          onClick={() => decide('accepted')}
          disabled={busy}
          className="gradient-purple-blue h-9 flex-1 rounded-full text-white shadow-soft hover:opacity-95"
        >
          {pending === 'accepted' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          Accept
        </Button>
        <Button
          onClick={() => decide('declined')}
          disabled={busy}
          variant="ghost"
          className="h-9 rounded-full text-muted-foreground hover:text-foreground"
        >
          {pending === 'declined' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          Not this week
        </Button>
      </footer>
    </motion.article>
  );
}

/** The fit score is the agent's confidence, so it is shown, not hidden. */
function FitChip({ score }: { score: number }) {
  const tone =
    score >= 75
      ? 'bg-success/10 text-success border-success/20'
      : score >= 55
        ? 'bg-primary/10 text-primary border-primary/20'
        : 'bg-warning/10 text-warning border-warning/25';

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center rounded-xl border px-2.5 py-1.5',
        tone,
      )}
      title="Fit out of 100: how confident the agent is that this window survives contact with your week"
    >
      <span className="text-base leading-none font-semibold tabular-nums">
        {score}
        <span className="text-[10px] font-medium opacity-70">/100</span>
      </span>
      <span className="text-[9px] font-semibold tracking-wide uppercase opacity-75">fit</span>
    </div>
  );
}
