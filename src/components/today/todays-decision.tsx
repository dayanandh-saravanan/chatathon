'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  CalendarOff,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  Sparkles,
} from 'lucide-react';

import { BAND_COPY } from '@/lib/domain/capacity';
import { clockTime, durationLabel } from '@/lib/domain/time';
import type { DayCapacity } from '@/lib/domain/types';
import { cn } from '@/lib/utils';
import { BAND_STYLE, bandColor } from './capacity-factors';

/** The one block on today's books, flattened to plain props by the server page. */
export interface TodaysBlock {
  id: string;
  questTitle: string;
  start: string;
  end: string;
  minutes: number;
  rationale: string[];
  risks: string[];
  completed: boolean;
}

interface TodaysDecisionProps {
  capacity: DayCapacity;
  block: TodaysBlock | null;
}

export function TodaysDecision({ capacity, block }: TodaysDecisionProps) {
  if (capacity.band === 'depleted') return <RefusalPanel capacity={capacity} />;
  if (block) return <BlockPanel capacity={capacity} block={block} />;
  return <OpenEveningPanel capacity={capacity} />;
}

function Shell({
  band,
  children,
}: {
  band: DayCapacity['band'];
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel shadow-medium">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(135deg, ${bandColor(band, 0.06)}, transparent 60%)` }}
      />
      <div className="relative z-10 p-8">{children}</div>
    </section>
  );
}

function PanelHeader({
  icon,
  band,
  eyebrow,
  title,
}: {
  icon: React.ReactNode;
  band: DayCapacity['band'];
  eyebrow: string;
  title: string;
}) {
  const style = BAND_STYLE[band];
  return (
    <div className="flex items-start gap-4">
      <div
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-2xl border',
          style.soft,
          style.border,
          style.text,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
    </div>
  );
}

/**
 * The refusal. This panel is the product: a scheduler that declines, out loud,
 * with the evidence it declined on.
 */
function RefusalPanel({ capacity }: { capacity: DayCapacity }) {
  // Every tile is one day's load, so the scope is stated once on the group
  // rather than repeated three times.
  const evidence = [
    { label: 'Meetings booked', value: durationLabel(capacity.meetingMinutes) },
    { label: 'Longest unbroken run', value: durationLabel(capacity.longestMeetingRun) },
    {
      label: 'Back-to-back handoffs',
      value: `${capacity.backToBackCount}`,
    },
  ];

  return (
    <Shell band="depleted">
      <PanelHeader
        band="depleted"
        icon={<CalendarOff className="size-5" />}
        eyebrow="Tonight's decision"
        title="Nothing scheduled tonight — on purpose"
      />

      <blockquote className="mt-6 border-l-2 border-danger/40 pl-4 text-[15px] leading-relaxed text-foreground/80">
        {BAND_COPY.depleted.blurb}
      </blockquote>

      <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Today&rsquo;s load
      </p>

      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {evidence.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-border/60 bg-white/55 px-4 py-3.5"
          >
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{item.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        A block placed on a day like this gets skipped, and a skipped block is how people quietly
        decide the whole thing is not for them. SideQuest looks again tomorrow morning.
      </p>

      <Link
        href="/plan"
        className="btn-glass mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground"
      >
        See when you actually can
        <ArrowRight className="size-4" />
      </Link>
    </Shell>
  );
}

function BlockPanel({ capacity, block }: { capacity: DayCapacity; block: TodaysBlock }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markDone() {
    if (pending) return;
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
    <Shell band={capacity.band}>
      <PanelHeader
        band={capacity.band}
        icon={<Sparkles className="size-5" />}
        eyebrow="Tonight's decision"
        title={block.completed ? 'Done tonight' : 'One block, held for you'}
      />

      <div className="mt-6 rounded-2xl border border-border/60 bg-white/55 px-5 py-4">
        <p className="text-base font-medium tracking-tight">{block.questTitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden />
            {clockTime(block.start)} – {clockTime(block.end)}
          </span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{durationLabel(block.minutes)}</span>
        </div>
      </div>

      {block.rationale.length > 0 && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Why this one
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {block.rationale.map((reason) => (
              <li key={reason} className="flex gap-2 text-sm leading-relaxed text-foreground/80">
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {block.risks.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Watch for
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {block.risks.map((risk) => (
              <li key={risk} className="flex gap-2 text-sm leading-relaxed text-foreground/80">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {block.completed ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-4 py-2 text-sm font-medium text-success">
            <CheckCheck className="size-4" aria-hidden />
            Logged
          </span>
        ) : (
          <button
            type="button"
            onClick={markDone}
            disabled={pending}
            className="btn-glass inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            Mark done
          </button>
        )}
        <Link
          href="/plan"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          See the rest of the week
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Shell>
  );
}

function OpenEveningPanel({ capacity }: { capacity: DayCapacity }) {
  return (
    <Shell band={capacity.band}>
      <PanelHeader
        band={capacity.band}
        icon={<Sparkles className="size-5" />}
        eyebrow="Tonight's decision"
        title="Nothing on the books tonight"
      />

      <blockquote className="mt-6 border-l-2 border-border pl-4 text-[15px] leading-relaxed text-foreground/80">
        {BAND_COPY[capacity.band].blurb}
      </blockquote>

      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        There is room for up to {durationLabel(capacity.dailyBudgetMinutes)} today. SideQuest will
        not fill it unless you want it filled.
      </p>

      <Link
        href="/plan"
        className="btn-glass mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-foreground/80 hover:text-foreground"
      >
        Find a window
        <ArrowRight className="size-4" />
      </Link>
    </Shell>
  );
}
