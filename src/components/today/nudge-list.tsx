'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BatteryLow,
  Check,
  Loader2,
  Lock,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

import { NUDGE_COPY } from '@/lib/domain/nudges';
import type { Nudge, NudgeKind, UserId } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/** Just enough of a teammate to render an avatar, kept serialisable. */
export interface NudgePerson {
  name: string;
  initials: string;
  accent: string;
}

interface NudgeListProps {
  nudges: Nudge[];
  people: Record<UserId, NudgePerson>;
}

const KIND_ICON: Record<NudgeKind, typeof MessageCircle> = {
  'check-in': MessageCircle,
  'protect-time': ShieldCheck,
  rest: BatteryLow,
  restart: RotateCcw,
};

/** NUDGE_COPY carries a tone name; this is the only place it becomes pixels. */
const TONE_BADGE: Record<string, string> = {
  primary: 'bg-primary/10 text-primary border-primary/20',
  secondary: 'bg-secondary/10 text-secondary border-secondary/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  success: 'bg-success/10 text-success border-success/20',
};

export function NudgeList({ nudges, people }: NudgeListProps) {
  const router = useRouter();
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [acted, setActed] = useState<Set<string>>(new Set());

  async function dismiss(id: string) {
    if (dismissing) return;
    setDismissing(id);
    try {
      const res = await fetch(`/api/nudges/${id}/dismiss`, { method: 'POST' });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      setHidden((prev) => new Set(prev).add(id));
      router.refresh();
    } catch {
      // Leave the card in place — a nudge that silently vanishes on a failed
      // request is worse than one that stays.
    } finally {
      setDismissing(null);
    }
  }

  const visible = nudges.filter((n) => !hidden.has(n.id));

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <div className="flex items-center gap-2">
          <Lock className="size-3.5 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight">Private to you</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Nobody else sees these. SideQuest does not post them and does not rank anyone.
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="glass-card rounded-3xl px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing needs you right now. Everyone is either moving or resting on purpose.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((nudge) => {
            const copy = NUDGE_COPY[nudge.kind];
            const Icon = KIND_ICON[nudge.kind];
            const person = people[nudge.aboutUserId];
            const isActed = acted.has(nudge.id);

            return (
              <article
                key={nudge.id}
                className="glass-card relative overflow-hidden rounded-3xl p-6 animate-smooth hover-lift"
              >
                <div className="flex items-start gap-4">
                  {person && (
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-xs font-semibold text-white"
                      style={{ background: `hsl(${person.accent})` }}
                      aria-hidden
                    >
                      {person.initials}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                          TONE_BADGE[copy.tone] ?? TONE_BADGE.primary,
                        )}
                      >
                        <Icon className="size-3" aria-hidden />
                        {copy.label}
                      </span>
                      {person && (
                        <span className="text-xs text-muted-foreground">about {person.name}</span>
                      )}
                    </div>

                    <h3 className="mt-2.5 text-base font-semibold tracking-tight">{nudge.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {nudge.message}
                    </p>

                    {nudge.reasons.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-border/60 bg-white/50 px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          What triggered this
                        </p>
                        <ul className="mt-2 flex flex-col gap-1">
                          {nudge.reasons.map((reason) => (
                            <li
                              key={reason}
                              className="flex gap-2 text-xs leading-relaxed text-foreground/75"
                            >
                              <span
                                className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60"
                                aria-hidden
                              />
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      {isActed ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-4 py-2 text-sm font-medium text-success">
                          <Check className="size-4" aria-hidden />
                          Handled — SideQuest will leave it alone this week
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setActed((prev) => new Set(prev).add(nudge.id))}
                            className="gradient-purple-blue inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-soft animate-smooth hover:opacity-90"
                          >
                            {copy.action}
                          </button>
                          <button
                            type="button"
                            onClick={() => dismiss(nudge.id)}
                            disabled={dismissing === nudge.id}
                            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground animate-smooth hover:text-foreground disabled:opacity-60"
                          >
                            {dismissing === nudge.id && (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden />
                            )}
                            Not now
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
