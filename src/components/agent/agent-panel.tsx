'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, CalendarClock, Flag, Sparkles, Target, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode, Ref } from 'react';

import { AgentLauncher } from '@/components/agent/agent-launcher';
import { MessageBubble, TypingBubble } from '@/components/agent/message-bubble';
import { Textarea } from '@/components/ui/textarea';
import { clockTime, dayLabel, durationLabel, shortDate } from '@/lib/domain/time';
import type { AgentAction, AgentMessage } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

const EASE_LIQUID: [number, number, number, number] = [0.17, 0.67, 0.27, 1];

const SUGGESTIONS = [
  'What can I realistically do this week?',
  'Why did you not schedule anything tonight?',
  'I want to get back into film photography',
];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface AgentDockProps {
  viewerName: string;
  /** Prior turns, if the page fetched them. The dock is happy without any. */
  initialMessages?: AgentMessage[];
}

/**
 * Launcher plus slide-over in one mount, so a single line in the app layout
 * puts the agent on every page.
 *
 * The slide-over is hand-rolled rather than built on `ui/sheet` because that
 * primitive bakes in a `bg-black/50` scrim, which is far too heavy for this
 * light glass system. Escape, scroll lock and focus handling are done here.
 */
export default function AgentDock({ viewerName, initialMessages = [] }: AgentDockProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  // Escape to close, and keep Tab inside the panel while it is modal.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const node = panelRef.current;
      if (!node) return;
      const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !node.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    composerRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Newest turn should already be on screen when the typing dots appear.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, pending, open]);

  async function send(text: string) {
    const body = text.trim();
    if (!body || pending) return;

    setDraft('');
    setError(null);
    setPending(true);
    setMessages((prev) => [
      ...prev,
      {
        // Local id only — the server assigns the durable one when it persists.
        id: `local-${prev.length}-${Date.now()}`,
        role: 'user',
        content: body,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: body }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { message: AgentMessage };
      setMessages((prev) => [...prev, data.message]);
      // The agent may have drafted a quest or booked windows; pull the page up to date.
      router.refresh();
    } catch {
      setError('The agent did not answer. Try that again in a moment.');
    } finally {
      setPending(false);
    }
  }

  const firstName = viewerName.split(' ')[0];

  return (
    <>
      <AgentLauncher open={open} onOpen={() => setOpen(true)} ref={launcherRef} />

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="agent-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: EASE_LIQUID }}
              onClick={close}
              className="fixed inset-0 z-40 bg-foreground/10 backdrop-blur-[2px]"
            />

            <motion.div
              key="agent-panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="agent-panel-title"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.42, ease: EASE_LIQUID }}
              className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border/70 sm:w-[420px] sm:rounded-l-3xl"
              style={{
                background: 'rgba(250, 250, 252, 0.86)',
                backdropFilter: 'blur(36px) saturate(180%)',
                WebkitBackdropFilter: 'blur(36px) saturate(180%)',
                boxShadow:
                  'inset 0 0 90px -46px hsl(var(--primary) / 0.5), -16px 0 48px rgba(71, 85, 105, 0.14)',
              }}
            >
              <PanelHeader onClose={close} />

              <div
                ref={scrollRef}
                aria-live="polite"
                className="flex-1 overflow-y-auto px-5 py-5"
              >
                {messages.length === 0 && !pending ? (
                  <EmptyState firstName={firstName} onPick={(text) => void send(text)} />
                ) : (
                  <div className="flex flex-col gap-4">
                    {messages.map((message) => (
                      <MessageBubble key={message.id} message={message}>
                        {message.actions?.map((action, index) => (
                          <ActionCard key={`${message.id}-${index}`} action={action} />
                        ))}
                      </MessageBubble>
                    ))}
                    <AnimatePresence>{pending && <TypingBubble />}</AnimatePresence>
                  </div>
                )}
              </div>

              <Composer
                ref={composerRef}
                value={draft}
                pending={pending}
                error={error}
                onChange={setDraft}
                onSend={() => void send(draft)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="flex items-center gap-2.5 border-b border-border/60 px-5 py-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
        <Sparkles className="size-4 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <h2
          id="agent-panel-title"
          className="text-[15px] font-semibold tracking-[0.08em] text-foreground"
        >
          SideQuest
        </h2>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          Reads your calendar and recovery. Books what fits.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the agent panel"
        className="-mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground animate-smooth ease-liquid hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </header>
  );
}

function EmptyState({
  firstName,
  onPick,
}: {
  firstName: string;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex h-full flex-col justify-end gap-5">
      <div>
        <p className="text-[15px] font-medium leading-snug text-foreground">
          Hi {firstName}. Ask me anything about your week.
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          I only book hobby time on days you can carry it, and I will tell you when the answer is
          nothing.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onPick(suggestion)}
            className="glass-card hover-lift rounded-2xl px-4 py-2.5 text-left text-[13.5px] leading-snug text-foreground animate-smooth ease-liquid"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: AgentAction }) {
  switch (action.type) {
    case 'quest-drafted': {
      const milestones = [...action.quest.milestones].sort((a, b) => a.order - b.order);
      return (
        <ResultShell icon={<Target className="size-3" />} label="Quest drafted">
          <p className="text-[13.5px] font-medium leading-snug text-foreground">
            {action.quest.title}
          </p>
          <ol className="mt-2.5 space-y-1.5">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="flex gap-2">
                <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {milestone.order}
                </span>
                <span className="min-w-0 text-[12.5px] leading-snug text-muted-foreground">
                  {milestone.title}
                </span>
              </li>
            ))}
          </ol>
        </ResultShell>
      );
    }

    case 'windows-proposed': {
      if (action.windows.length === 0) return null;
      return (
        <ResultShell icon={<CalendarClock className="size-3" />} label="Blocks proposed">
          <ul className="space-y-2">
            {action.windows.map((window) => (
              <li
                key={window.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-medium text-foreground">
                    {dayLabel(window.date)}, {shortDate(window.date)}
                  </span>
                  <span className="block text-[12px] tabular-nums text-muted-foreground">
                    {clockTime(window.start)} – {clockTime(window.end)} ·{' '}
                    {durationLabel(window.minutes)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                  fit {window.score}/100
                </span>
              </li>
            ))}
          </ul>
        </ResultShell>
      );
    }

    case 'nudge-drafted':
      return (
        <ResultShell icon={<Flag className="size-3" />} label="Private check-in">
          <p className="text-[13.5px] font-medium leading-snug text-foreground">
            {action.nudge.title}
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
            {action.nudge.message}
          </p>
        </ResultShell>
      );

    case 'none':
      return null;
  }
}

function ResultShell({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.1, ease: EASE_LIQUID }}
      className="w-full rounded-2xl border border-primary/20 bg-primary/[0.055] p-3.5"
    >
      <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-primary">
        {icon}
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </motion.div>
  );
}

function Composer({
  ref,
  value,
  pending,
  error,
  onChange,
  onSend,
}: {
  ref: Ref<HTMLTextAreaElement>;
  value: string;
  pending: boolean;
  error: string | null;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  const empty = value.trim().length === 0;

  return (
    <div className="border-t border-border/60 px-5 py-4">
      {error ? (
        <p role="alert" className="mb-2 text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
        className="flex items-end gap-2 rounded-2xl border border-border/70 bg-white/70 p-2 shadow-soft backdrop-blur-sm"
      >
        <Textarea
          ref={ref}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is how you write a second line.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder="Ask about your week"
          aria-label="Message SideQuest"
          disabled={pending}
          className="max-h-32 min-h-[36px] flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-[14px] leading-relaxed shadow-none focus-visible:ring-0"
        />
        <button
          type="submit"
          disabled={pending || empty}
          aria-label="Send"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-white shadow-soft animate-smooth ease-liquid',
            empty || pending ? 'bg-muted-foreground/30' : 'bg-primary hover:opacity-90',
          )}
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  );
}
