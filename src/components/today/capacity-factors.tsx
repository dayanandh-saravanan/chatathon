import { Activity, CalendarDays, HeartPulse, Moon } from 'lucide-react';

import { bandFor } from '@/lib/domain/capacity';
import type { CapacityBand, CapacityFactor, DayCapacity } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/**
 * Band presentation lives here rather than in each surface: the dial, the week
 * strip and the decision panel all have to agree on the same three colours,
 * otherwise the score stops reading as one number and starts reading as three.
 */
export interface BandStyle {
  /** CSS custom property holding the band hue, for inline SVG and gradient use. */
  token: string;
  text: string;
  soft: string;
  border: string;
  ring: string;
}

export const BAND_STYLE: Record<CapacityBand, BandStyle> = {
  depleted: {
    token: '--danger',
    text: 'text-danger',
    soft: 'bg-danger/10',
    border: 'border-danger/25',
    ring: 'ring-danger/40',
  },
  steady: {
    token: '--warning',
    text: 'text-warning',
    soft: 'bg-warning/10',
    border: 'border-warning/25',
    ring: 'ring-warning/40',
  },
  primed: {
    token: '--success',
    text: 'text-success',
    soft: 'bg-success/10',
    border: 'border-success/25',
    ring: 'ring-success/40',
  },
};

export function bandColor(band: CapacityBand, alpha?: number): string {
  const token = BAND_STYLE[band].token;
  return alpha === undefined ? `hsl(var(${token}))` : `hsl(var(${token}) / ${alpha})`;
}

const FACTOR_ICON: Record<CapacityFactor['key'], typeof Activity> = {
  recovery: HeartPulse,
  sleep: Moon,
  meetings: CalendarDays,
  strain: Activity,
};

/** `11.8`, but `20` rather than `20.0` — trailing zeros make the sum look invented. */
function points(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

interface CapacityFactorsProps {
  capacity: DayCapacity;
}

/**
 * The arithmetic behind the score, shown rather than asserted.
 *
 * Every bar sits on the same 0–100 ruler: a factor's track is exactly as wide
 * as the points it is allowed to contribute, and the filled part is what it
 * actually contributed today. So the four bars tile into the total, and the
 * total is the number on the dial.
 */
export function CapacityFactors({ capacity }: CapacityFactorsProps) {
  const { factors, score } = capacity;
  const weightSum = factors.reduce((sum, f) => sum + f.maxPoints, 0);

  // Each segment starts where the earlier factors' contributions ended, so the
  // stacked bar tiles into the total without gaps.
  const segments = factors.map((factor, i) => ({
    factor,
    left: factors.slice(0, i).reduce((sum, f) => sum + f.points, 0),
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold tracking-tight">Where the number comes from</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {factors.map((f) => f.maxPoints).join(' + ')} = {weightSum} possible
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {factors.map((factor) => {
          const Icon = FACTOR_ICON[factor.key];
          const health = bandFor(factor.normalised * 100);

          return (
            <div key={factor.key} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  {factor.label}
                </span>
                <span className="flex items-baseline gap-2.5 text-xs">
                  <span className="tabular-nums">
                    <span className="font-medium text-foreground">{points(factor.points)}</span>
                    <span className="text-muted-foreground">/{factor.maxPoints}</span>
                  </span>
                  <span className="text-muted-foreground">{factor.detail}</span>
                </span>
              </div>

              {/* The full width is the whole 100-point scale; the track is the slice
                  this factor is allowed to occupy, and the fill is what it earned. */}
              <div className="relative h-2.5 w-full">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-foreground/[0.06]"
                  style={{ width: `${factor.maxPoints}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${factor.points}%`,
                    background: `linear-gradient(90deg, ${bandColor(health, 0.7)}, ${bandColor(health)})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-white/50 px-4 py-3.5">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-foreground/[0.05]">
          {segments.map(({ factor, left }) => (
            <div
              key={factor.key}
              className="absolute inset-y-0 rounded-full"
              style={{
                left: `${left}%`,
                width: `${factor.points}%`,
                background: bandColor(bandFor(factor.normalised * 100)),
              }}
            />
          ))}
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {factors.map((f) => points(f.points)).join(' + ')} ={' '}
          <span className={cn('font-semibold', BAND_STYLE[capacity.band].text)}>{score}</span> out of{' '}
          {weightSum}
        </p>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Free time is not the same as capable time. A calendar app sees an empty 7pm and books it.
        SideQuest sees the hours that came before it.
      </p>
    </div>
  );
}
