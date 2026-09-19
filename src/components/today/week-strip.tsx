import { BAND_COPY } from '@/lib/domain/capacity';
import { dayLabel, fromDateKey } from '@/lib/domain/time';
import type { CapacityBand, DateKey, DayCapacity } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { BAND_STYLE, bandColor } from './capacity-factors';

interface WeekStripProps {
  /** Monday-anchored, exactly seven days. */
  days: DayCapacity[];
  todayKey: DateKey;
}

const BANDS: CapacityBand[] = ['depleted', 'steady', 'primed'];

export function WeekStrip({ days, todayKey }: WeekStripProps) {
  return (
    <section className="glass-panel shadow-soft">
      <div className="relative z-10 p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 className="text-sm font-semibold tracking-tight">This week</h2>
          <div className="flex items-center gap-4">
            {BANDS.map((band) => (
              <span key={band} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="size-2 rounded-full"
                  style={{ background: bandColor(band) }}
                  aria-hidden
                />
                {BAND_COPY[band].label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-2.5">
          {days.map((day) => {
            const isToday = day.date === todayKey;
            const style = BAND_STYLE[day.band];

            return (
              <div
                key={day.date}
                title={`${dayLabel(day.date)} — ${day.score}/100, ${BAND_COPY[day.band].label.toLowerCase()}`}
                className={cn(
                  'relative rounded-2xl border bg-white/55 px-2 py-3.5 text-center animate-smooth',
                  isToday
                    ? cn('border-transparent ring-2 ring-offset-2 ring-offset-background', style.ring)
                    : 'border-border/60 hover-lift',
                )}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {dayLabel(day.date).slice(0, 1)}
                </div>
                <div className="text-[10px] tabular-nums text-muted-foreground/70">
                  {fromDateKey(day.date).getDate()}
                </div>

                <div className={cn('mt-2 text-lg font-semibold tabular-nums tracking-tight', style.text)}>
                  {day.score}
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${day.score}%`, background: bandColor(day.band) }}
                  />
                </div>

                {isToday && (
                  <span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Today
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
