'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { Quest } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/**
 * Typing one sentence and getting a ladder back is the agent demo, so this
 * stays the first interactive thing on the landing page — just as a single
 * line that grows when you touch it rather than a block of form.
 *
 * The agent's output is the interesting part, and a plain `router.refresh()`
 * swallows it: the new quest would appear indistinguishable from a database
 * row. So the drafted milestones are held on screen for a beat first, then the
 * server data catches up underneath them.
 */
const REFRESH_DELAY_MS = 2600;
const CLEAR_DELAY_MS = 4600;

const PLACEHOLDER = 'I want to play three Bruno Mars songs on guitar by December';

export function NewQuestForm() {
  const router = useRouter();
  const [goalText, setGoalText] = useState('');
  const [focused, setFocused] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<Quest | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    const refresh = setTimeout(() => router.refresh(), REFRESH_DELAY_MS);
    const clear = setTimeout(() => setDraft(null), CLEAR_DELAY_MS);
    return () => {
      clearTimeout(refresh);
      clearTimeout(clear);
    };
  }, [draft, router]);

  async function submit() {
    const text = goalText.trim();
    if (!text || pending) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalText: text }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const data = (await res.json()) as { quest: Quest };
      setDraft(data.quest);
      setGoalText('');
    } catch {
      setError('That did not go through. Try it once more.');
    } finally {
      setPending(false);
    }
  }

  const expanded = focused || goalText.length > 0;

  return (
    <section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        // Plain utilities rather than `.glass-panel`: that class is unlayered
        // CSS, so its 1.5rem radius and clipping would beat `rounded-full`.
        className={cn(
          'shadow-soft animate-smooth ease-liquid flex items-center gap-2.5 rounded-full border border-border bg-card/80 px-3.5 backdrop-blur-xl',
          expanded ? 'py-2 ring-1 ring-primary/35' : 'py-1.5',
        )}
      >
        <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />

        <label htmlFor="sidequest-goal" className="sr-only">
          Start a quest
        </label>
        <input
          id="sidequest-goal"
          value={goalText}
          onChange={(e) => setGoalText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={PLACEHOLDER}
          disabled={pending}
          autoComplete="off"
          // The global `*:focus-visible` rule is unlayered and would draw a
          // rounded rectangle inside this pill; the ring moves to the form.
          style={{ outline: 'none' }}
          className="relative z-10 min-w-0 flex-1 border-0 bg-transparent py-1 text-[14px] leading-6 text-foreground placeholder:text-muted-foreground/80 disabled:opacity-60"
        />

        <button
          type="submit"
          aria-label="Start a quest"
          disabled={pending || goalText.trim().length === 0}
          className="animate-smooth relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft hover:opacity-90 disabled:opacity-30"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden />
          )}
        </button>
      </form>

      <AnimatePresence>
        {expanded && !draft ? (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden pl-4 text-[12px] text-muted-foreground"
          >
            <span className="block pt-1.5">
              {pending ? 'Working out the steps…' : 'Say it plainly. The agent builds the ladder and finds the hours.'}
            </span>
          </motion.p>
        ) : null}
      </AnimatePresence>

      {error ? (
        <p role="alert" className="mt-1.5 pl-4 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <div aria-live="polite">
        <AnimatePresence>
          {draft ? (
            <motion.div
              key={draft.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: [0.17, 0.67, 0.27, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-primary">
                  Drafted just now
                </p>
                <p className="mt-1 text-[15px] font-medium leading-snug text-foreground">
                  {draft.title}
                </p>
                <ol className="mt-3 space-y-1.5">
                  {[...draft.milestones]
                    .sort((a, b) => a.order - b.order)
                    .map((m, i) => (
                      <motion.li
                        key={m.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.12 + i * 0.09, duration: 0.3 }}
                        className="flex min-w-0 items-center gap-2.5"
                      >
                        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-primary/12 text-[10px] font-semibold text-primary">
                          {m.order}
                        </span>
                        <span className="truncate text-[13px] leading-5 text-foreground">
                          {m.title}
                        </span>
                      </motion.li>
                    ))}
                </ol>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
