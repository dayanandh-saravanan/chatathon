'use client';

import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/utils';

/**
 * The one avatar in the app.
 *
 * Photos are still arriving from the team, so every surface has to survive a
 * missing file: an absent `photoUrl` *and* a 404 on a present one both land on
 * the same initials chip tinted with the member's accent. Nothing here throws,
 * and nothing here shifts layout — the box is the same size in both states.
 */

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  /** Full name; used for the alt text and the title tooltip. */
  name: string;
  /** Two-letter fallback, e.g. `TP`. */
  initials: string;
  /** HSL triplet, e.g. `262 52% 62%`. Tints the fallback chip. */
  accent: string;
  /** `/people/<handle>.jpg`. Optional — most are not uploaded yet. */
  photoUrl?: string;
  size?: AvatarSize;
  className?: string;
}

const PX: Record<AvatarSize, number> = { sm: 28, md: 36, lg: 56, xl: 96 };

/** Initials should read as a label, not shout, so they stay well under half the box. */
const TEXT: Record<AvatarSize, string> = {
  sm: 'text-[10px]',
  md: 'text-[11px]',
  lg: 'text-[15px]',
  xl: 'text-[26px]',
};

export function Avatar({
  name,
  initials,
  accent,
  photoUrl,
  size = 'md',
  className,
}: AvatarProps) {
  // Remember *which* URL failed rather than a bare boolean. This component
  // lives in the persistent sidebar and never unmounts, so a boolean would
  // latch: the member's file 404s once, and the face stays hidden for the rest
  // of the session even after their photo is uploaded and `photoUrl` changes.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const px = PX[size];
  const showPhoto = Boolean(photoUrl) && failedUrl !== photoUrl;

  return (
    <span
      title={name}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        className,
      )}
      style={{
        width: px,
        height: px,
        // A thin white ring plus a soft shadow is what lifts a photo off the
        // off-white page in the reference UI.
        boxShadow: showPhoto
          ? '0 0 0 1.5px rgba(255,255,255,0.9), 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)'
          : `inset 0 0 0 1px hsl(${accent} / 0.26)`,
        backgroundColor: showPhoto ? undefined : `hsl(${accent} / 0.15)`,
        color: showPhoto ? undefined : `hsl(${accent})`,
      }}
    >
      {showPhoto ? (
        <Image
          src={photoUrl as string}
          alt={name}
          width={px}
          height={px}
          // Local demo files; the optimiser adds nothing and would 500 on a
          // file that is not there yet.
          unoptimized
          // `onError` is load-bearing beyond the handler itself: next/image
          // only re-fires a pre-hydration error (image-component.js, the
          // `img.src = img.src` replay) when this prop is passed. Drop it and
          // an above-the-fold 404 keeps the browser's broken-image icon.
          onError={() => setFailedUrl(photoUrl ?? null)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={cn('font-semibold leading-none', TEXT[size])}>{initials}</span>
      )}
    </span>
  );
}

export default Avatar;
