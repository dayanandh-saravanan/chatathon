import { cn } from '@/lib/utils';
import { BAND_COPY } from '@/lib/domain/capacity';
import { clockTime, dayLabel } from '@/lib/domain/time';
import type {
  CalendarEvent,
  CapacityBand,
  DateKey,
  DayCapacity,
  QuestWindow,
} from '@/lib/domain/types';

/**
 * The week, drawn the way a calendar is drawn — because the argument SideQuest
 * makes is visual: the grey is what work took, and the colour is what is left.
 *
 * Plain CSS grid with blocks absolutely positioned by minute offset. A charting
 * library would give us axes we do not want and a layout we cannot control.
 */

const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = END_HOUR - START_HOUR;
/**
 * Pixels per hour. 26 puts a full 6am–10pm day in 416px — roughly two thirds
 * of the old height, which is what makes the whole page fit one screen.
 */
const HOUR_HEIGHT = 26;
const GRID_HEIGHT = HOURS * HOUR_HEIGHT;
/** Below this a block cannot hold two lines of text, so it shows only a title. */
const COMPACT_HEIGHT = 26;
/** Only every other hour is labelled; at 26px a label per row is a picket fence. */
const LABEL_EVERY = 2;

const BAND_DOT: Record<CapacityBand, string> = {
  depleted: 'hsl(var(--danger))',
  steady: 'hsl(var(--warning))',
  primed: 'hsl(var(--success))',
};

interface Placed {
  key: string;
  startMin: number;
  endMin: number;
  title: string;
  detail: string;
  variant: 'work' | 'accepted' | 'proposed' | 'missed';
  lane: number;
  lanes: number;
}

function minutesFromGridStart(instant: string): number {
  const d = new Date(instant);
  return d.getHours() * 60 + d.getMinutes() - START_HOUR * 60;
}

/**
 * Side-by-side lanes for anything that overlaps. Overlaps are rare here — the
 * scheduler avoids busy time — but a double-booked morning should look
 * double-booked rather than hide one invite behind another.
 */
function assignLanes(items: Omit<Placed, 'lane' | 'lanes'>[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const lanes = cluster.reduce((max, c) => Math.max(max, c.lane + 1), 1);
    for (const c of cluster) out.push({ ...c, lanes });
    cluster = [];
  };

  for (const item of sorted) {
    if (item.startMin >= clusterEnd) flush();
    const taken = new Set(
      cluster.filter((c) => c.endMin > item.startMin).map((c) => c.lane),
    );
    let lane = 0;
    while (taken.has(lane)) lane += 1;
    cluster.push({ ...item, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();

  return out;
}

const BLOCK_STYLE: Record<Placed['variant'], string> = {
  work: 'bg-muted-foreground/10 border border-border text-foreground/70',
  accepted: 'bg-primary text-primary-foreground border border-white/30 shadow-soft',
  proposed:
    'bg-primary/10 border-2 border-dashed border-primary/55 text-primary backdrop-blur-sm',
  missed: 'border border-dashed border-muted-foreground/30 text-muted-foreground/70',
};

export interface WeekGridProps {
  /** Seven Monday-anchored days of capacity. */
  days: DayCapacity[];
  events: CalendarEvent[];
  windows: QuestWindow[];
  questTitles: Record<string, string>;
  todayKey: DateKey;
}

export function WeekGrid({ days, events, windows, questTitles, todayKey }: WeekGridProps) {
  const hourMarks = Array.from({ length: HOURS + 1 }, (_, i) => START_HOUR + i);

  const byDay = new Map<DateKey, Placed[]>();
  for (const day of days) {
    const raw: Omit<Placed, 'lane' | 'lanes'>[] = [];

    for (const e of events) {
      if (e.start.slice(0, 10) !== day.date) continue;
      raw.push({
        key: e.id,
        startMin: minutesFromGridStart(e.start),
        endMin: minutesFromGridStart(e.end),
        title: e.title,
        detail: `${clockTime(e.start)} – ${clockTime(e.end)}`,
        variant: 'work',
      });
    }

    for (const w of windows) {
      if (w.date !== day.date) continue;
      if (w.status === 'declined') continue;
      raw.push({
        key: w.id,
        startMin: minutesFromGridStart(w.start),
        endMin: minutesFromGridStart(w.end),
        title: questTitles[w.questId] ?? 'SideQuest block',
        detail: `${clockTime(w.start)} – ${clockTime(w.end)}`,
        variant:
          w.status === 'proposed' ? 'proposed' : w.status === 'missed' ? 'missed' : 'accepted',
      });
    }

    byDay.set(day.date, assignLanes(raw));
  }

  return (
    <div className="glass-panel p-4">
      <div className="relative z-10">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <h2 className="text-[13px] font-semibold">Your week</h2>
          <Legend />
        </div>

        {/* minmax(0,1fr) is what keeps seven columns from forcing a scrollbar. */}
        <div className="grid grid-cols-[34px_repeat(7,minmax(0,1fr))] gap-x-1">
          <div aria-hidden />
          {days.map((day) => (
            <DayHeader key={day.date} day={day} isToday={day.date === todayKey} />
          ))}
        </div>

        <div
          className="relative mt-1.5 grid grid-cols-[34px_repeat(7,minmax(0,1fr))] gap-x-1"
          style={{ height: GRID_HEIGHT }}
        >
          <div className="pointer-events-none absolute inset-0 z-0">
            {hourMarks.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-t border-border/70"
                style={{ top: i * HOUR_HEIGHT }}
              />
            ))}
          </div>

          <div className="relative">
            {hourMarks.slice(0, -1).map((h, i) =>
              (h - START_HOUR) % LABEL_EVERY === 0 ? (
                <span
                  key={h}
                  className="absolute right-1 text-[10px] font-medium tabular-nums text-muted-foreground/70"
                  style={{ top: i * HOUR_HEIGHT + 1 }}
                >
                  {hourLabel(h)}
                </span>
              ) : null,
            )}
          </div>

          {days.map((day) => (
            <div
              key={day.date}
              className={cn(
                'relative rounded-xl',
                day.date === todayKey && 'bg-primary/[0.045] ring-1 ring-primary/15',
              )}
            >
              {(byDay.get(day.date) ?? []).map((block) => (
                <Block key={block.key} block={block} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? 'a' : 'p'}`;
}

function DayHeader({ day, isToday }: { day: DayCapacity; isToday: boolean }) {
  const dayNumber = Number(day.date.slice(8, 10));
  return (
    <div className="min-w-0 px-0.5 text-center">
      <div
        className={cn(
          'text-[11px] font-medium tracking-wide uppercase',
          isToday ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {dayLabel(day.date)} {dayNumber}
      </div>
      {/* The band survives as a dot, not a filled pill — seven coloured bars
          across the top of a calendar reads as an alarm panel. */}
      <div
        className="mt-0.5 inline-flex w-full items-center justify-center gap-1 text-[11px] font-medium tabular-nums"
        title={`${BAND_COPY[day.band].label} — ${day.headline}`}
      >
        <span className="size-1.5 rounded-full" style={{ background: BAND_DOT[day.band] }} />
        <span className={isToday ? 'text-foreground' : 'text-muted-foreground'}>{day.score}</span>
      </div>
    </div>
  );
}

function Block({ block }: { block: Placed }) {
  const top = Math.max(0, (block.startMin / 60) * HOUR_HEIGHT);
  const rawHeight = ((block.endMin - block.startMin) / 60) * HOUR_HEIGHT;
  const height = Math.max(12, Math.min(rawHeight, GRID_HEIGHT - top));
  const width = 100 / block.lanes;
  const compact = height < COMPACT_HEIGHT;

  return (
    <div
      className={cn(
        'absolute overflow-hidden rounded-md px-1 py-px text-[9px] leading-tight',
        BLOCK_STYLE[block.variant],
      )}
      style={{
        top,
        height,
        left: `calc(${block.lane * width}% + 2px)`,
        width: `calc(${width}% - 4px)`,
      }}
      title={`${block.title} · ${block.detail}`}
    >
      <p className="truncate font-semibold">{block.title}</p>
      {/* A 45-minute block is two lines tall, so the tag takes the second line
          rather than adding a third — the exact time is on the proposal card. */}
      {!compact &&
        (block.variant === 'proposed' ? (
          <p className="truncate text-[9px] font-semibold tracking-wide uppercase opacity-90">
            Proposed
          </p>
        ) : (
          <p className="truncate opacity-80">{block.detail}</p>
        ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-muted-foreground">
      <LegendSwatch className="bg-muted-foreground/25" label="Work" />
      <LegendSwatch className="bg-primary" label="On the books" />
      <LegendSwatch
        className="border-2 border-dashed border-primary/60 bg-primary/10"
        label="Proposed"
      />
      <LegendSwatch
        className="border border-dashed border-muted-foreground/40"
        label="Missed"
      />
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-3 rounded-[5px]', className)} />
      {label}
    </span>
  );
}
