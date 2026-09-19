import { Check, Lock } from 'lucide-react';

import type { Milestone } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/**
 * The ladder is the answer to "what does progress even look like here".
 * A quest is not a percentage — it is a short list of concrete things, one of
 * which you are on right now. Locked steps stay visible but quiet, so the
 * ladder reads as a path rather than a backlog.
 */

function StepNode({ status }: { status: Milestone['status'] }) {
  if (status === 'done') {
    return (
      <span className="gradient-purple-blue flex size-7 items-center justify-center rounded-full shadow-soft">
        <Check className="size-4 text-white" strokeWidth={2.5} aria-hidden />
      </span>
    );
  }

  if (status === 'current') {
    return (
      // A ring rather than a fill: this step is open, not finished.
      <span className="gradient-purple-blue flex size-7 items-center justify-center rounded-full shadow-medium">
        <span className="size-3 rounded-full bg-background" />
      </span>
    );
  }

  return (
    <span className="flex size-7 items-center justify-center rounded-full border border-border bg-background">
      <Lock className="size-3 text-muted-foreground" aria-hidden />
    </span>
  );
}

function SessionProgress({ done, estimated }: { done: number; estimated: number }) {
  const pct = estimated > 0 ? Math.min(100, (done / estimated) * 100) : 0;

  return (
    <div className="mt-2.5 flex items-center gap-2.5">
      <div className="h-1 w-28 overflow-hidden rounded-full bg-border">
        <div className="gradient-purple-blue h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">
        {done} of {estimated} sessions
      </span>
    </div>
  );
}

interface MilestoneLadderProps {
  milestones: Milestone[];
  className?: string;
}

export function MilestoneLadder({ milestones, className }: MilestoneLadderProps) {
  const steps = [...milestones].sort((a, b) => a.order - b.order);
  if (steps.length === 0) return null;

  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const done = step.status === 'done';
        const current = step.status === 'current';

        return (
          <li key={step.id} className="relative grid grid-cols-[1.75rem_1fr] gap-x-4 pb-5 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[0.84rem] top-8 bottom-0 w-px',
                  done ? 'bg-primary/35' : 'bg-border',
                )}
              />
            ) : null}

            <StepNode status={step.status} />

            <div className="min-w-0 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={cn(
                    'text-sm font-medium leading-snug',
                    current && 'text-foreground',
                    done && 'text-foreground/70',
                    step.status === 'locked' && 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </span>
                {current ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Now
                  </span>
                ) : null}
              </div>

              <p
                className={cn(
                  'mt-0.5 text-sm leading-snug',
                  step.status === 'locked' ? 'text-muted-foreground/70' : 'text-muted-foreground',
                )}
              >
                {step.detail}
              </p>

              {current ? (
                <SessionProgress done={step.sessionsDone} estimated={step.estimatedSessions} />
              ) : null}

              {step.status === 'locked' ? (
                <p className="mt-1.5 text-xs text-muted-foreground/70">
                  About {step.estimatedSessions} sessions when you get here.
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
