'use client';

import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * The photo half of a feed card.
 *
 * Most `photoUrl`s point at files the team has not sent yet, so a missing file
 * is the normal case rather than an error case. Both states — no URL at all,
 * and a URL that 404s — land on the same gradient tile carrying the post's
 * glyph, at the identical aspect ratio, so the grid never reflows and no
 * broken-image icon ever renders.
 */

export interface PhotoTileProps {
  /** `/posts/<id>.jpg`. Optional; most posts are glyph-only. */
  photoUrl?: string;
  /** Emoji fallback, always present on a `Post`. */
  glyph: string;
  /** Describes the post, e.g. "Mara's post about Guitar". */
  alt: string;
  /** Aspect and radius come from the caller, e.g. `aspect-[4/5] rounded-t-2xl`. */
  className?: string;
}

export function PhotoTile({ photoUrl, glyph, alt, className }: PhotoTileProps) {
  // Keyed by URL, not a boolean: a tile that failed once must light up if the
  // post's photo is later replaced, rather than latching on the dead path.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = Boolean(photoUrl) && failedUrl !== photoUrl;

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {showPhoto ? (
        <Image
          src={photoUrl as string}
          alt={alt}
          fill
          // Local demo files. The optimiser adds nothing here and errors on a
          // path that is not on disk yet, which is exactly the case we are
          // trying to survive.
          unoptimized
          sizes="(min-width: 1536px) 18rem, (min-width: 1024px) 24vw, (min-width: 640px) 45vw, 90vw"
          // Load-bearing beyond the handler: next/image only replays an error
          // that landed before hydration when an `onError` prop is present.
          onError={() => setFailedUrl(photoUrl ?? null)}
          className="object-cover"
        />
      ) : (
        <div
          aria-label={alt}
          role="img"
          className="absolute inset-0 grid place-items-center"
          style={{
            backgroundImage:
              'linear-gradient(135deg, hsl(var(--primary) / 0.20) 0%, hsl(var(--secondary) / 0.14) 100%)',
          }}
        >
          <span
            aria-hidden
            className="text-6xl drop-shadow-[0_6px_14px_rgba(71,85,105,0.18)]"
          >
            {glyph}
          </span>
        </div>
      )}
    </div>
  );
}

export default PhotoTile;
