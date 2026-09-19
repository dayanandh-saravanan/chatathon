'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ImagePlus, Loader2, Moon, Send, Sparkles, X } from 'lucide-react';
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

/** The fallback tile when someone has no photo to hand. */
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
  const fileInput = React.useRef<HTMLInputElement>(null);

  const [kind, setKind] = React.useState<ComposerKind>('progress');
  const [questId, setQuestId] = React.useState(quests[0]?.id ?? '');
  const [body, setBody] = React.useState('');
  const [minutes, setMinutes] = React.useState('');
  const [glyph, setGlyph] = React.useState(GLYPHS.progress[0]);

  /** Local object URL — shown the instant a file is picked, before the upload lands. */
  const [preview, setPreview] = React.useState<string | null>(null);
  /** Server path returned by `/api/upload`; this is what the post stores. */
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Object URLs leak until revoked, and the preview outlives several renders.
  React.useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  function changeKind(next: ComposerKind) {
    setKind(next);
    setGlyph(GLYPHS[next][0]);
    if (next === 'rest') setMinutes('');
  }

  function clearPhoto() {
    setPreview(null);
    setPhotoUrl(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setPhotoUrl(null);
    setUploading(true);
    setError(null);

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', 'post');
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          json && typeof json === 'object' && 'error' in json
            ? String((json as { error: unknown }).error)
            : 'That image did not upload.';
        throw new Error(message);
      }
      const url =
        json && typeof json === 'object' && 'url' in json
          ? String((json as { url: unknown }).url)
          : null;
      if (!url) throw new Error('That image did not upload.');
      setPhotoUrl(url);
    } catch (err) {
      // The preview goes with it — keeping it would promise a photo the post
      // is not going to carry.
      clearPhoto();
      setError(err instanceof Error ? err.message : 'That image did not upload.');
    } finally {
      setUploading(false);
    }
  }

  const parsedMinutes = Number.parseInt(minutes, 10);
  const canPost = Boolean(questId) && body.trim().length > 0 && !pending && !uploading;

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
          photoUrl: photoUrl ?? undefined,
          minutes:
            kind === 'progress' && Number.isFinite(parsedMinutes) && parsedMinutes > 0
              ? parsedMinutes
              : undefined,
        }),
      });
      if (!res.ok) throw new Error('post failed');
      router.push('/feed');
      router.refresh();
    } catch {
      setError('That did not go through. Try again.');
      setPending(false);
    }
  }

  if (quests.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <p className="text-[13px] text-muted-foreground">
          Start a quest and you can post progress here.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft"
    >
      <div
        role="radiogroup"
        aria-label="Post kind"
        className="flex w-fit items-center gap-1 rounded-full border border-border bg-white/60 p-1"
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
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium animate-smooth',
              kind === option.value
                ? 'bg-primary/12 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <option.icon className="size-3.5" />
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
        {/* The preview is the same square the feed tile crops to, so what you
            see here is what the grid will show. */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Photo</Label>

          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
            {preview ? (
              <Image
                src={preview}
                alt="Your photo"
                fill
                unoptimized
                sizes="11rem"
                className="object-cover"
              />
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground animate-smooth hover:text-primary"
              >
                <ImagePlus className="size-6" />
                <span className="text-[11px]">Add a photo</span>
              </button>
            )}

            {uploading ? (
              <span className="absolute inset-0 grid place-items-center bg-white/65">
                <Loader2 className="size-5 animate-spin text-primary" />
              </span>
            ) : null}

            {preview && !uploading ? (
              <button
                type="button"
                onClick={clearPhoto}
                aria-label="Remove photo"
                className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-white/90 text-muted-foreground shadow-soft animate-smooth hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            onChange={pickPhoto}
            className="sr-only"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="composer-quest" className="text-xs text-muted-foreground">
              Quest
            </Label>
            <Select value={questId} onValueChange={setQuestId}>
              <SelectTrigger
                id="composer-quest"
                className="w-full rounded-md border-border bg-white/60"
              >
                {/* Explicit children: Radix only resolves item text after the
                    content has mounted, so the server HTML would otherwise
                    ship an empty box. */}
                <SelectValue placeholder="Pick a quest">
                  {quests.find((q) => q.id === questId)?.title}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-md">
                {quests.map((quest) => (
                  <SelectItem key={quest.id} value={quest.id}>
                    {quest.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="composer-body" className="text-xs text-muted-foreground">
              Caption
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
              className="min-h-20 resize-none rounded-md border-border bg-white/60 text-[13px] leading-relaxed"
            />
          </div>

          {kind === 'progress' ? (
            <div className="flex w-24 flex-col gap-1.5">
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
                className="rounded-md border-border bg-white/60"
              />
            </div>
          ) : null}

          {/* Fallback tile for anyone without a photo to hand. */}
          {photoUrl ? null : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Tile instead</Label>
              <div className="flex flex-wrap gap-1.5">
                {GLYPHS[kind].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGlyph(option)}
                    aria-label={`Use ${option}`}
                    aria-pressed={glyph === option}
                    className={cn(
                      'grid size-8 place-items-center rounded-md border text-base animate-smooth',
                      glyph === option
                        ? 'border-primary/35 bg-primary/10'
                        : 'border-border bg-white/55 hover:border-primary/20',
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p
          className={cn('text-xs', error ? 'text-danger' : 'text-muted-foreground')}
          role={error ? 'alert' : undefined}
        >
          {error ?? 'Ten minutes counts. So does a night off.'}
        </p>

        <div className="flex items-center gap-2">
          <Link
            href="/feed"
            className="rounded-full px-3 py-1.5 text-[13px] text-muted-foreground animate-smooth hover:text-foreground"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={!canPost}
            className="rounded-full bg-primary px-5 text-primary-foreground shadow-soft hover:opacity-90"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Post
          </Button>
        </div>
      </div>
    </form>
  );
}
