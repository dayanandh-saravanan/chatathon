'use client';

import { useState } from 'react';
import { Check, CheckCheck, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { BAND_COPY, bandFor } from '@/lib/domain/capacity';
import { clockTime, durationLabel } from '@/lib/domain/time';
import type { CapacityBand, CapacityFactor, DailySignal, DayCapacity } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/**
 * The capacity strip.
 *
 * One horizontal band: the number, the four inputs behind it, and what that
 * means for tonight. It replaces the old full-page dial — the team's note was
 * "I don't even know what I'm looking at", so the framing line says in plain
 * words what the number is before the number appears.
 *
 * Colour discipline: the band hue survives only as a 1.5px dot and a 3px bar.
 * Wide red/amber/green fills read as alarm states and are off-brand here.
 */

/** Today's single booked block, flattened to plain props by the server page. */
export interface TodayBlock {
  id: string;
  questTitle: string;
  start: string;
  end: string;
  minutes: number;
  completed: boolean;
}

export interface CapacitySummaryProps {
  capacity: DayCapacity;
  block: TodayBlock | null;
  /** Today's wearable reading, used for the raw value beside each factor. */
  signal?: DailySignal | null;
}

/**
 * The domain labels a factor "Calendar load" / "Day strain". On a strip this
 * narrow the single nouns read faster, and they match what the team says out
 * loud: recovery, sleep, meetings, strain.
 */
const FACTOR_LABEL: Record<CapacityFactor['key'], string> = {
  recovery: 'Recovery',
  sleep: 'Sleep',
  meetings: 'Meetings',
  strain: 'Strain',
};

function bandColor(band: CapacityBand): string {
  if (band === 'primed') return 'hsl(var(--success))';
  if (band === 'steady') return 'hsl(var(--warning))';
  return 'hsl(var(--danger))';
}

/** The raw reading, short enough to sit on one line beside the label. */
function rawValue(
  factor: CapacityFactor,
  capacity: DayCapacity,
  signal: DailySignal | null | undefined,
): string {
  switch (factor.key) {
    case 'recovery':
      return signal ? `${Math.round(signal.recovery)}%` : factor.detail;
    case 'sleep':
      return signal ? `${signal.sleepHours.toFixed(1)}h` : factor.detail;
    case 'meetings':
      return capacity.meetingMinutes === 0 ? 'None' : durationLabel(capacity.meetingMinutes);
    case 'strain':
      return signal ? `${signal.dayStrain.toFixed(1)} of 21` : factor.detail;
  }
}

export function CapacitySummary({ capacity, block, signal }: CapacitySummaryProps) {
  const color = bandColor(capacity.band);

  return (
    <section className="glass-panel p-4 sm:p-5">
      <div className="relative z-10 flex flex-col gap-3.5">
        <p className="text-xs text-muted-foreground">
          How much you have left for yourself today, read from your calendar and your WHOOP data.
        </p>

        <div className="grid gap-4 lg:grid-cols-[132px_minmax(0,1fr)_minmax(0,232px)] lg:gap-6">
          <div title={capacity.headline}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[38px] leading-none font-semibold tracking-tight tabular-nums">
                {capacity.score}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>

            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-2 py-0.5 text-[11px] font-medium">
              <span
                className="size-1.5 rounded-full"
                style={{ background: color }}
                aria-hidden
              />
              {BAND_COPY[capacity.band].label}
            </span>

            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-foreground/[0.08]">
              <div
                className="h-full rounded-full"
                style={{ width: `${capacity.score}%`, background: color }}
              />
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {capacity.factors.map((factor) => (
              <FactorBar
                key={factor.key}
                factor={factor}
                value={rawValue(factor, capacity, signal)}
              />
            ))}
          </div>

          <Tonight capacity={capacity} block={block} />
        </div>
      </div>
    </section>
  );
}

/**
 * One input, on the same 0–100 ruler as every other. The fill is the factor's
 * own health, not its share of the score — the share lives in the tooltip,
 * which is where arithmetic belongs at this density.
 */
function FactorBar({ factor, value }: { factor: CapacityFactor; value: string }) {
  const health = bandFor(factor.normalised * 100);

  return (
    <div
      title={`${factor.label}: ${factor.points} of ${factor.maxPoints} points · ${factor.detail}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          {FACTOR_LABEL[factor.key]}
          {health === 'depleted' && (
            <span
              className="size-1.5 rounded-full bg-danger"
              aria-label="limiting factor"
            />
          )}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{value}</span>
      </div>
      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-foreground/[0.08]">
        <div
          className="h-full rounded-full bg-foreground/35"
          style={{ width: `${Math.round(factor.normalised * 100)}%` }}
        />
      </div>
    </div>
  );
}

/** The decision, in one sentence — plus the one button that acts on it. */
function Tonight({ capacity, block }: { capacity: DayCapacity; block: TodayBlock | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markDone() {
    if (!block || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/windows/${block.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      router.refresh();
    } catch {
      setError('That did not save. Try once more.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="lg:border-l lg:border-border lg:pl-6">
      <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Tonight
      </p>

      {block ? (
        <>
          <p className="mt-1.5 truncate text-[13px] font-medium" title={block.questTitle}>
            {block.questTitle}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {clockTime(block.start)} – {clockTime(block.end)} · {durationLabel(block.minutes)}
          </p>
          <div className="mt-2">
            {block.completed ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCheck className="size-3.5" aria-hidden />
                Logged
              </span>
            ) : (
              <button
                type="button"
                onClick={markDone}
                disabled={pending}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-1 text-xs font-medium animate-smooth',
                  'hover:border-primary/40 hover:text-primary disabled:opacity-60',
                )}
              >
                {pending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="size-3.5" aria-hidden />
                )}
                Mark done
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-[13px] leading-snug text-foreground/80">
          {capacity.band === 'depleted'
            ? BAND_COPY.depleted.blurb
            : `Nothing booked. Room for up to ${durationLabel(capacity.dailyBudgetMinutes)} tonight.`}
        </p>
      )}

      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
