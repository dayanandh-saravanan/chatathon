'use client';

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

import { BAND_COPY, BAND_THRESHOLDS } from '@/lib/domain/capacity';
import type { DayCapacity } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { BAND_STYLE, bandColor } from './capacity-factors';

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 112;
const STROKE = 20;
/** A 270° arc opening at the bottom, so the gap reads as a dial and not a ring. */
const START_ANGLE = 135;
const SWEEP = 270;

function pointOn(angleDeg: number, radius: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  // Rounded to three decimals: React serialises SVG numbers differently on the
  // server and the client at full float precision, which trips a hydration
  // mismatch on the tick marks.
  const round3 = (n: number) => Math.round(n * 1000) / 1000;
  return [round3(CENTER + radius * Math.cos(rad)), round3(CENTER + radius * Math.sin(rad))];
}

const [ARC_X0, ARC_Y0] = pointOn(START_ANGLE, RADIUS);
const [ARC_X1, ARC_Y1] = pointOn(START_ANGLE + SWEEP, RADIUS);
const ARC = `M ${ARC_X0.toFixed(2)} ${ARC_Y0.toFixed(2)} A ${RADIUS} ${RADIUS} 0 1 1 ${ARC_X1.toFixed(2)} ${ARC_Y1.toFixed(2)}`;

/** Where the bands change, notched into the track so the thresholds are not a secret. */
const TICKS = [BAND_THRESHOLDS.steady, BAND_THRESHOLDS.primed];

interface CapacityDialProps {
  capacity: DayCapacity;
}

export function CapacityDial({ capacity }: CapacityDialProps) {
  const { score, band, headline } = capacity;
  const style = BAND_STYLE[band];
  const reduceMotion = useReducedMotion();

  // The sweep is driven by a dash-offset transition rather than a JS animation:
  // the number in the middle is always the real score, and the arc fills in to
  // meet it one frame after hydration.
  const [swept, setSwept] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSwept(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // `pathLength={1}` normalises the arc, so dash units are just fractions.
  const dashOffset = swept ? 1 - score / 100 : 1;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: SIZE, maxWidth: '100%' }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-12 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, ${bandColor(band, 0.28)}, transparent 70%)` }}
        />

        <svg
          viewBox={`0 0 ${SIZE} ${SIZE - 10}`}
          className="relative w-full"
          role="img"
          aria-label={`Capacity ${score} out of 100 — ${BAND_COPY[band].label}`}
        >
          <defs>
            <linearGradient id="capacity-arc" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor={bandColor(band, 0.55)} />
              <stop offset="100%" stopColor={bandColor(band)} />
            </linearGradient>
          </defs>

          <path
            d={ARC}
            fill="none"
            stroke="hsl(var(--foreground) / 0.07)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />

          {TICKS.map((tick) => {
            const angle = START_ANGLE + SWEEP * (tick / 100);
            const [x0, y0] = pointOn(angle, RADIUS - STROKE / 2 - 1);
            const [x1, y1] = pointOn(angle, RADIUS + STROKE / 2 + 1);
            return (
              <line
                key={tick}
                x1={x0}
                y1={y0}
                x2={x1}
                y2={y1}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            );
          })}

          <path
            d={ARC}
            fill="none"
            stroke="url(#capacity-arc)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={dashOffset}
            style={{
              transition: reduceMotion
                ? 'none'
                : 'stroke-dashoffset 1.15s cubic-bezier(0.17, 0.67, 0.27, 1)',
            }}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-3">
          <span className="text-[68px] font-semibold leading-none tracking-tighter tabular-nums">
            {score}
          </span>
          <span className="mt-1 text-xs font-medium tabular-nums text-muted-foreground">
            out of 100
          </span>
          <span
            className={cn(
              'mt-3 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]',
              style.text,
              style.soft,
              style.border,
            )}
          >
            {BAND_COPY[band].label}
          </span>
        </div>
      </div>

      <p className="max-w-[320px] text-center text-sm leading-relaxed text-muted-foreground">
        {headline}
      </p>
    </div>
  );
}
