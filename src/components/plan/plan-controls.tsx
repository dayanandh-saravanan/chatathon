'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Moon, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { QuestWindow } from '@/lib/domain/types';

export interface QuestOption {
  id: string;
  title: string;
}

interface PlanResult {
  title: string;
  note: string;
  count: number;
}

export interface PlanControlsProps {
  quests: QuestOption[];
}

export function PlanControls({ quests }: PlanControlsProps) {
  const router = useRouter();
  const [questId, setQuestId] = useState(quests[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = quests.find((q) => q.id === questId);

  async function replan() {
    if (!questId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agent/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as {
        windows: QuestWindow[];
        note: string;
        title: string;
      };
      setResult({ title: data.title, note: data.note, count: data.windows.length });
      router.refresh();
    } catch {
      setError('The agent could not be reached. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-panel p-5">
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Ask the agent to plan</h2>
            <p className="text-sm text-muted-foreground">
              It reads the next ten days of calendar load and recovery, then places blocks only
              where they will survive.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={questId} onValueChange={setQuestId} disabled={quests.length === 0}>
              {/* `data-[size=default]:h-10` rather than a bare `h-10`: the
                  primitive sets its own height under that same variant, which
                  otherwise wins and leaves the trigger 4px shorter than the
                  button beside it. */}
              <SelectTrigger className="w-full min-w-0 rounded-full border-border bg-white/60 data-[size=default]:h-10 sm:w-[340px]">
                {/* Radix only resolves the selected label once the portal has
                    mounted, so the label is passed through explicitly — the
                    trigger must read correctly on the very first paint. The
                    inner span carries the truncation because the value slot is
                    a flex box, which defeats the primitive's line clamp. */}
                <SelectValue placeholder="Pick a quest">
                  <span className="block min-w-0 truncate">{selected?.title}</span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {quests.map((q) => (
                  <SelectItem key={q.id} value={q.id} className="rounded-xl">
                    {q.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={replan}
              disabled={loading || !questId}
              className="gradient-purple-blue h-10 rounded-full px-5 text-white shadow-soft hover:opacity-95"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {loading ? 'Reading your week' : 'Re-plan my week'}
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {error && (
            <ResultPanel key="error" tone="muted" icon={<Moon className="size-4" />} title="Nothing came back">
              {error}
            </ResultPanel>
          )}
          {!error && result && (
            /* An empty plan is the product working, not an error — so it lands in
               the same calm panel as a full one, never in a red one. */
            <ResultPanel
              key={`${result.title}-${result.count}`}
              tone={result.count === 0 ? 'quiet' : 'primary'}
              icon={
                result.count === 0 ? <Moon className="size-4" /> : <Sparkles className="size-4" />
              }
              title={result.title}
            >
              {result.note}
            </ResultPanel>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const TONE: Record<'primary' | 'quiet' | 'muted', string> = {
  primary: 'border-primary/20 bg-primary/[0.06] text-primary',
  quiet: 'border-border bg-muted/70 text-foreground',
  muted: 'border-border bg-muted/70 text-muted-foreground',
};

function ResultPanel({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'primary' | 'quiet' | 'muted';
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.17, 0.67, 0.27, 1] }}
      className="overflow-hidden"
    >
      <div className={cn('flex gap-3 rounded-2xl border p-4', TONE[tone])}>
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-sm text-foreground/75">{children}</p>
        </div>
      </div>
    </motion.div>
  );
}
