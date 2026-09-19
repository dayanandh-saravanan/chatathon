'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Quest } from '@/lib/domain/types';

/**
 * The agent's output is the interesting part, and a plain `router.refresh()`
 * swallows it — the new quest just appears, indistinguishable from a database
 * row. So the freshly drafted milestones are held on screen for a beat first,
 * then the server data catches up underneath them.
 */
const REFRESH_DELAY_MS = 2600;
const CLEAR_DELAY_MS = 4600;

const PLACEHOLDER = 'I want to play three Bruno Mars songs on guitar by December';

export function NewQuestForm() {
  const router = useRouter();
  const [goalText, setGoalText] = useState('');
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

  return (
    <section className="glass-panel p-6 sm:p-7">
      <div className="relative z-10">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label
            htmlFor="sidequest-goal"
            className="text-base font-medium tracking-tight text-foreground"
          >
            What do you want to get back to?
          </label>
          <p className="mt-1 text-sm text-muted-foreground">
            Say it the way you would say it to a friend. The agent turns it into a ladder and finds
            the hours.
          </p>

          <Textarea
            id="sidequest-goal"
            value={goalText}
            onChange={(e) => setGoalText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={PLACEHOLDER}
            rows={3}
            disabled={pending}
            className="mt-4 min-h-[92px] resize-none rounded-2xl border-border/70 bg-white/70 px-4 py-3 text-[15px] leading-relaxed shadow-soft backdrop-blur-sm"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              One quest at a time works better than four.
            </span>
            <Button
              type="submit"
              size="lg"
              disabled={pending || goalText.trim().length === 0}
              className="gradient-purple-blue rounded-full px-6 text-white shadow-soft animate-smooth hover:opacity-90"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Working out the steps
                </>
              ) : (
                <>
                  <Sparkles className="size-4" aria-hidden />
                  Start a quest
                </>
              )}
            </Button>
          </div>
        </form>

        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
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
                <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.06] p-5">
                  <p className="text-xs font-medium uppercase tracking-wider text-primary">
                    Drafted just now
                  </p>
                  <p className="mt-1.5 text-base font-medium leading-snug text-foreground">
                    {draft.title}
                  </p>
                  <ol className="mt-4 space-y-2.5">
                    {[...draft.milestones]
                      .sort((a, b) => a.order - b.order)
                      .map((m, i) => (
                        <motion.li
                          key={m.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.12 + i * 0.09, duration: 0.3 }}
                          className="flex gap-3"
                        >
                          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {m.order}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium leading-snug text-foreground">
                              {m.title}
                            </span>
                            <span className="block text-sm leading-snug text-muted-foreground">
                              {m.detail}
                            </span>
                          </span>
                        </motion.li>
                      ))}
                  </ol>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
