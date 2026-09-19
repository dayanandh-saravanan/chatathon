'use client';

import * as React from 'react';
import { Loader2, Moon, Send, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PostKind } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/** Composable kinds. `milestone` and `restart` are the agent's to award, not the member's. */
type ComposerKind = Extract<PostKind, 'progress' | 'rest'>;

/** Fixed glyph sets — a stand-in for the photo picker a real build would have. */
const GLYPHS: Record<ComposerKind, string[]> = {
  progress: ['🎸', '🏃', '🍳', '📷', '📖', '⌨️', '🌿', '✨'],
  rest: ['🌙', '☕', '🛋️', '🌧️', '📺', '🧘'],
};

export interface ComposerQuest {
  id: string;
  title: string;
}

interface PostComposerProps {
  quests: ComposerQuest[];
}

export function PostComposer({ quests }: PostComposerProps) {
  const router = useRouter();

  const [kind, setKind] = React.useState<ComposerKind>('progress');
  const [questId, setQuestId] = React.useState(quests[0]?.id ?? '');
  const [body, setBody] = React.useState('');
  const [minutes, setMinutes] = React.useState('');
  const [glyph, setGlyph] = React.useState(GLYPHS.progress[0]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function changeKind(next: ComposerKind) {
    setKind(next);
    setGlyph(GLYPHS[next][0]);
    if (next === 'rest') setMinutes('');
  }

  const parsedMinutes = Number.parseInt(minutes, 10);
  const canPost = Boolean(questId) && body.trim().length > 0 && !pending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questId,
          body: body.trim(),
          kind,
          glyph,
          minutes:
            kind === 'progress' && Number.isFinite(parsedMinutes) && parsedMinutes > 0
              ? parsedMinutes
              : undefined,
        }),
      });
      if (!res.ok) throw new Error('post failed');
      setBody('');
      setMinutes('');
      router.refresh();
    } catch {
      setError('That did not go through. Try again.');
    } finally {
      setPending(false);
    }
  }

  if (quests.length === 0) {
    return (
      <div className="glass-panel rounded-3xl p-6 shadow-soft">
        <p className="relative z-10 text-sm text-muted-foreground">
          Start a quest and you can post progress here.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="glass-panel rounded-3xl p-5 shadow-soft sm:p-6">
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Post what you did</h2>
            <p className="text-xs text-muted-foreground">
              Ten minutes counts. So does a night off.
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Post kind"
            className="flex items-center gap-1 rounded-full border border-border bg-white/60 p-1"
          >
            {(
              [
                { value: 'progress', label: 'Progress', icon: Sparkles },
                { value: 'rest', label: 'Rest', icon: Moon },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={kind === option.value}
                onClick={() => changeKind(option.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium animate-smooth',
                  kind === option.value
                    ? 'bg-primary/12 text-primary shadow-soft'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <option.icon className="size-3.5" />
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="composer-quest" className="text-xs text-muted-foreground">
            Quest
          </Label>
          <Select value={questId} onValueChange={setQuestId}>
            <SelectTrigger
              id="composer-quest"
              className="w-full rounded-2xl border-border bg-white/60 py-5"
            >
              {/* Explicit children: Radix only resolves item text after the
                  content has mounted, so the server HTML would otherwise ship
                  an empty box. */}
              <SelectValue placeholder="Pick a quest">
                {quests.find((q) => q.id === questId)?.title}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {quests.map((quest) => (
                <SelectItem key={quest.id} value={quest.id}>
                  {quest.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="composer-body" className="text-xs text-muted-foreground">
            What happened
          </Label>
          <Textarea
            id="composer-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder={
              kind === 'rest'
                ? 'Recovery was low so I sat this one out.'
                : 'Chord changes are finally clean.'
            }
            className="min-h-24 resize-none rounded-2xl border-border bg-white/60 leading-relaxed"
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-muted-foreground">Glyph</Label>
            <div className="flex flex-wrap gap-1.5">
              {GLYPHS[kind].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGlyph(option)}
                  aria-label={`Use ${option}`}
                  aria-pressed={glyph === option}
                  className={cn(
                    'grid size-9 place-items-center rounded-xl border text-lg animate-smooth',
                    glyph === option
                      ? 'border-primary/35 bg-primary/10 scale-105'
                      : 'border-border bg-white/55 hover:border-primary/20',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {kind === 'progress' ? (
            <div className="flex w-28 flex-col gap-2">
              <Label htmlFor="composer-minutes" className="text-xs text-muted-foreground">
                Minutes
              </Label>
              <Input
                id="composer-minutes"
                type="number"
                min={1}
                max={600}
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="45"
                className="rounded-2xl border-border bg-white/60"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground" role={error ? 'alert' : undefined}>
            {error ?? 'Nobody here is ranked against anybody.'}
          </p>
          <Button
            type="submit"
            disabled={!canPost}
            className="gradient-purple-blue rounded-full px-5 text-white shadow-soft hover:opacity-90"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Post
          </Button>
        </div>
      </div>
    </form>
  );
}
