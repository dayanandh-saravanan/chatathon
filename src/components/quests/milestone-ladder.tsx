'use client';

import { Check, ChevronDown, Lock } from 'lucide-react';
import { useState } from 'react';

import type { Milestone } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/**
 * The ladder answers "what does progress even look like here" — a quest is not
 * a percentage, it is a short list of concrete things, one of which you are on
 * right now.
 *
 * Collapsed it shows only that one step, because on the landing page the other
 * four are a wall of text nobody reads. The expander keeps them one click away
 * rather than gone.
 */

function StepNode({ status }: { status: Milestone['status'] }) {
  if (status === 'done') {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-primary">
        <Check className="size-3 text-white" strokeWidth={3} aria-hidden />
      </span>
    );
  }

  if (status === 'current') {
    return (
      // A ring rather than a fill: this step is open, not finished.
      <span className="flex size-5 items-center justify-center rounded-full bg-primary">
        <span className="size-2 rounded-full bg-background" />
      </span>
    );
  }

  return (
    <span className="flex size-5 items-center justify-center rounded-full border border-border bg-background">
      <Lock className="size-2.5 text-muted-foreground" aria-hidden />
    </span>
  );
}

function Row({
  step,
  isLast,
  showDetail,
}: {
  step: Milestone;
  isLast: boolean;
  showDetail: boolean;
}) {
  const current = step.status === 'current';

  return (
    <li className="relative grid grid-cols-[1.25rem_1fr] gap-x-3 pb-2.5 last:pb-0">
      {!isLast ? (
        <span
          aria-hidden
          className={cn(
            'absolute left-[0.59rem] top-[1.375rem] bottom-0 w-px',
            step.status === 'done' ? 'bg-primary/30' : 'bg-border',
          )}
        />
      ) : null}

      <StepNode status={step.status} />

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'truncate text-[13px] leading-5',
              current && 'font-medium text-foreground',
              step.status === 'done' && 'text-muted-foreground',
              step.status === 'locked' && 'text-muted-foreground',
            )}
          >
            {step.title}
          </span>
          {current ? (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              {step.sessionsDone} of {step.estimatedSessions} sessions
            </span>
          ) : null}
        </div>

        {showDetail ? (
          <p className="truncate text-[12px] leading-5 text-muted-foreground/80">{step.detail}</p>
        ) : null}
      </div>
    </li>
  );
}

interface MilestoneLadderProps {
  milestones: Milestone[];
  /** Collapse to the step in play, with the rest behind an expander. */
  collapsible?: boolean;
  className?: string;
}

export function MilestoneLadder({
  milestones,
  collapsible = false,
  className,
}: MilestoneLadderProps) {
  const [open, setOpen] = useState(false);

  const steps = [...milestones].sort((a, b) => a.order - b.order);
  if (steps.length === 0) return null;

  // A finished quest has no `current`; falling back to the last step keeps the
  // collapsed view from rendering an empty ladder.
  const focusIndex = Math.max(
    0,
    steps.findIndex((s) => s.status === 'current') === -1
      ? steps.length - 1
      : steps.findIndex((s) => s.status === 'current'),
  );

  const collapsed = collapsible && !open;
  const visible = collapsed ? [steps[focusIndex]] : steps;
  const hidden = steps.length - 1;

  return (
    <div className={className}>
      <ol className="flex flex-col">
        {visible.map((step, i) => (
          <Row
            key={step.id}
            step={step}
            isLast={i === visible.length - 1}
            showDetail={!collapsed}
          />
        ))}
      </ol>

      {collapsible && hidden > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="animate-smooth mt-1 inline-flex items-center gap-1 rounded-full pl-[0.1rem] text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn('size-3.5 animate-smooth', open && 'rotate-180')}
            aria-hidden
          />
          {open ? 'Fewer steps' : `${hidden} more`}
        </button>
      ) : null}
    </div>
  );
}
