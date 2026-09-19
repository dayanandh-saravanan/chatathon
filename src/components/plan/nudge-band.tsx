'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Lock } from 'lucide-react';

import { Avatar } from '@/components/avatar';
import { NUDGE_COPY } from '@/lib/domain/nudges';
import type { Nudge, UserId } from '@/lib/domain/types';

/**
 * The private check-in column.
 *
 * SideQuest never ranks anyone, so this is the only place a teammate's quiet
 * week surfaces — to one person, privately. It is a demo beat, so it stays
 * visible on /plan rather than moving behind a tab.
 */

/** Just enough of a teammate to render an avatar, kept serialisable. */
export interface NudgePerson {
  name: string;
  initials: string;
  accent: string;
  photoUrl?: string;
}

export interface NudgeBandProps {
  nudges: Nudge[];
  people: Record<UserId, NudgePerson>;
}

export function NudgeBand({ nudges, people }: NudgeBandProps) {
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
      // A nudge that silently vanishes on a failed request is worse than one
      // that stays, so the card is left in place.
    } finally {
      setDismissing(null);
    }
  }

  const visible = nudges.filter((n) => !hidden.has(n.id));

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <Lock className="size-3 text-muted-foreground" aria-hidden />
        <h2 className="text-[13px] font-semibold">Private to you</h2>
        <span className="text-[11px] text-muted-foreground">· nobody else sees these</span>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
          Nothing needs you right now.
        </p>
      ) : (
        visible.map((nudge) => {
          const copy = NUDGE_COPY[nudge.kind];
          const person = people[nudge.aboutUserId];
          const isActed = acted.has(nudge.id);

          return (
            <article
              key={nudge.id}
              className="rounded-2xl border border-border bg-card/70 p-3.5 shadow-soft"
            >
              <div className="flex items-start gap-2.5">
                {person && (
                  <Avatar
                    name={person.name}
                    initials={person.initials}
                    accent={person.accent}
                    photoUrl={person.photoUrl}
                    size="sm"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug font-medium">{nudge.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                    {nudge.message}
                  </p>
                </div>
              </div>

              {nudge.reasons.length > 0 && (
                <details className="mt-2 group">
                  <summary className="cursor-pointer list-none text-[11px] font-medium text-muted-foreground hover:text-foreground">
                    Why this came up
                  </summary>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {nudge.reasons.map((reason) => (
                      <li key={reason} className="flex gap-1.5 text-[11px] leading-snug text-foreground/70">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="mt-2.5 flex items-center gap-2">
                {isActed ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                    <Check className="size-3.5" aria-hidden />
                    Handled
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setActed((prev) => new Set(prev).add(nudge.id))}
                      className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground animate-smooth hover:opacity-90"
                    >
                      {copy.action}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(nudge.id)}
                      disabled={dismissing === nudge.id}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground animate-smooth hover:text-foreground disabled:opacity-60"
                    >
                      {dismissing === nudge.id && (
                        <Loader2 className="size-3 animate-spin" aria-hidden />
                      )}
                      Not now
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
