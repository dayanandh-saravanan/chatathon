'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, LayoutList, Send, Sparkles, User, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { MessageBubble, TypingBubble } from '@/components/agent/message-bubble';
import { Avatar } from '@/components/avatar';
import { PhotoTile } from '@/components/feed/photo-tile';
import { Orb } from '@/components/quests/orb';
import { QuestCard } from '@/components/quests/quest-card';
import { clockTime, dateKey, durationLabel, relativeDay } from '@/lib/domain/time';
import type {
  AgentAction,
  AgentMessage,
  Quest,
  QuestStreak,
  QuestWindow,
  TeamMember,
} from '@/lib/domain/types';
import { cn } from '@/lib/utils';

/**
 * The quest studio — the agent as a full page.
 *
 * Opens on a ring of the team's post photos orbiting a glass orb, with the
 * teammates in an inner orbit you can pull into the plan, and one bar at the
 * bottom to talk to the agent. That is the reference project's signature
 * screen, adapted: their ring was restaurants, ours is what the team has
 * actually been doing.
 *
 * Three modes, one component so the bar never remounts:
 *   orb    — the ring; the default.
 *   thread — a normal chat when the reply is words, not a quest.
 *   list   — every quest, newest first, the moment the agent drafts one.
 */

export interface RingPhoto {
  id: string;
  photoUrl?: string;
  glyph: string;
  alt: string;
  authorName: string;
  questTitle?: string;
}

export interface QuestStudioProps {
  teammates: TeamMember[];
  quests: Quest[];
  streaks: Record<string, QuestStreak>;
  photos: RingPhoto[];
  initialMessages: AgentMessage[];
}

type Mode = 'orb' | 'thread' | 'list';

const EASE_LIQUID: [number, number, number, number] = [0.17, 0.67, 0.27, 1];

const PROMPT = 'What do you want to get back to?';
const PLACEHOLDER = 'I want to play three Bruno Mars songs by December';

/** Cycled under the orb while the agent works. Each one is a real step. */
const THINKING = [
  'Reading your calendar',
  'Checking recovery and strain',
  'Finding the hours you can carry',
  'Building the ladder',
];

/** Radians per millisecond. A full turn takes about seventy seconds at rest. */
const SPIN_IDLE = 0.00009;
const SPIN_BUSY = 0.00036;

const round2 = (n: number) => Math.round(n * 100) / 100;

function firstName(member: TeamMember): string {
  return member.name.split(' ')[0];
}

/** Server snapshot is `false`, so nothing measured or timed renders during SSR. */
const subscribeNoop = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

/** Kept outside the component so the compiler lint does not see clock reads in render. */
function localUserMessage(content: string): AgentMessage {
  const now = new Date();
  return {
    id: `local_${now.getTime().toString(36)}`,
    role: 'user',
    content,
    createdAt: now.toISOString(),
  };
}

function emptyStreak(quest: Quest): QuestStreak {
  return {
    questId: quest.id,
    weeks: 0,
    quietDays: null,
    minutesThisWeek: 0,
    minutesLastWeek: 0,
    sessionsThisWeek: 0,
    adherence: 0,
    // Matches the server: a quest with no sessions is new, not quiet.
    health: 'steady',
  };
}

export function QuestStudio({
  teammates,
  quests,
  streaks,
  photos,
  initialMessages,
}: QuestStudioProps) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('orb');
  const [messages, setMessages] = useState<AgentMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [included, setIncluded] = useState<Set<string>>(() => new Set());
  const [newQuest, setNewQuest] = useState<Quest | null>(null);
  const [lastReply, setLastReply] = useState<AgentMessage | null>(null);
  // True for the beat between the agent's answer and the list: the photos
  // fall into the orb, then the new quest slides out of it.
  const [absorbing, setAbsorbing] = useState(false);

  // Ring geometry is measured on the client; nothing position-dependent is
  // rendered on the server so there is nothing to mismatch on hydration.
  const mounted = useMounted();
  const [stage, setStage] = useState(600);
  const [angle, setAngle] = useState(0);
  const [phrase, setPhrase] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      setStage(Math.max(420, Math.min(720, Math.min(width, height))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // The ring turns continuously; tiles are placed by angle rather than rotated,
  // so the photos stay upright the whole way round.
  useEffect(() => {
    if (mode === 'list') return;
    let raf = 0;
    let last = performance.now();
    const speed = pending ? SPIN_BUSY : SPIN_IDLE;
    const tick = (now: number) => {
      setAngle((a) => a + (now - last) * speed);
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mode, pending]);

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setPhrase((p) => (p + 1) % THINKING.length), 1500);
    return () => clearInterval(id);
  }, [pending]);

  useEffect(() => {
    if (mode !== 'thread') return;
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [mode, messages, pending]);

  const includedMembers = teammates.filter((t) => included.has(t.id));

  const listed = useMemo(() => {
    const merged = newQuest && !quests.some((q) => q.id === newQuest.id)
      ? [newQuest, ...quests]
      : quests;
    return [...merged].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [quests, newQuest]);

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || pending) return;

    const names = includedMembers.map(firstName);
    const content = names.length > 0 ? `${text} — with ${names.join(' and ')}` : text;

    setMessages((m) => [...m, localUserMessage(content)]);
    setDraft('');
    setError(null);
    setPhrase(0);
    setPending(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, with: names }),
      });
      if (!res.ok) throw new Error(`Request failed with ${res.status}`);
      const { message } = (await res.json()) as { message: AgentMessage };
      setMessages((m) => [...m, message]);

      const drafted = message.actions?.find((a) => a.type === 'quest-drafted');
      if (drafted && drafted.type === 'quest-drafted') {
        setNewQuest(drafted.quest);
        setLastReply(message);
        setIncluded(new Set());
        // Let the ring collapse into the orb before the list takes over.
        setAbsorbing(true);
        await new Promise((r) => setTimeout(r, 750));
        setAbsorbing(false);
        setMode('list');
      } else {
        setMode('thread');
      }
      router.refresh();
    } catch {
      setError('That did not go through. Try it once more.');
      setMode((m) => (m === 'list' ? m : 'thread'));
    } finally {
      setPending(false);
    }
  }

  function toggleIncluded(id: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    inputRef.current?.focus();
  }

  const c = stage / 2;
  const tile = Math.round(stage * 0.155);
  const photoRadius = stage * 0.42;
  const orbSize = Math.round(stage * 0.22);

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      {/* ------------------------------------------------------------ top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          {mode !== 'orb' ? (
            <button
              type="button"
              onClick={() => setMode('orb')}
              className="btn-glass flex h-8 items-center gap-1 px-3 text-[12.5px] font-medium text-foreground"
            >
              <ChevronLeft className="size-3.5" aria-hidden />
              Back to the agent
            </button>
          ) : (
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-primary" aria-hidden />
              SideQuest agent
            </span>
          )}
        </div>
        {mode !== 'list' ? (
          <button
            type="button"
            onClick={() => setMode('list')}
            className="btn-glass flex h-8 items-center gap-1.5 px-3 text-[12.5px] font-medium text-foreground"
          >
            <LayoutList className="size-3.5" aria-hidden />
            Your quests
            <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold tabular-nums text-primary">
              {listed.length}
            </span>
          </button>
        ) : (
          <span className="text-[12px] text-muted-foreground">Newest first</span>
        )}
      </div>

      {/* --------------------------------------------------------------- body */}
      <div ref={stageRef} className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait">
          {mode === 'orb' && (
            <motion.div
              key="orb"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.35, ease: EASE_LIQUID }}
              className="absolute inset-0 grid place-items-center"
            >
              <div className="relative" style={{ width: stage, height: stage }}>
                {/* centre */}
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                  <motion.div
                    animate={absorbing ? { scale: 1.35 } : { scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <Orb size={orbSize} active={pending || absorbing} />
                  </motion.div>
                  <motion.p
                    key={absorbing ? 'made' : pending ? `t${phrase}` : 'idle'}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: [0.55, 1, 0.55], y: 0 }}
                    transition={{
                      opacity: { duration: pending ? 1.5 : 3, repeat: Infinity, ease: 'easeInOut' },
                      y: { duration: 0.3 },
                    }}
                    className="mt-5 whitespace-nowrap bg-gradient-to-r from-[hsl(var(--primary))] via-[hsl(var(--secondary))] to-[hsl(var(--primary))] bg-clip-text text-[15px] font-semibold text-transparent"
                  >
                    {absorbing ? 'Quest made' : pending ? `${THINKING[phrase]}…` : PROMPT}
                  </motion.p>
                </div>

                {mounted && (
                  <>
                    {/* photos */}
                    {photos.map((photo, i) => {
                      const a = (i / Math.max(photos.length, 3)) * Math.PI * 2 + angle;
                      const x = round2(c + Math.cos(a) * photoRadius);
                      const y = round2(c + Math.sin(a) * photoRadius);
                      const glowing = pending && (i + Math.floor(angle * 4)) % 3 === 0;
                      return (
                        <motion.div
                          key={photo.id}
                          className="absolute"
                          initial={{ opacity: 0, scale: 0.3 }}
                          animate={
                            absorbing
                              ? { opacity: 0, scale: 0.15, left: c, top: c }
                              : { opacity: 1, scale: 1 }
                          }
                          transition={
                            absorbing
                              ? { duration: 0.6, delay: 0.02 * i, ease: [0.4, 0, 0.2, 1] }
                              : {
                                  opacity: { duration: 0.4, delay: 0.05 * i },
                                  scale: { duration: 0.5, delay: 0.05 * i, ease: [0.34, 1.56, 0.64, 1] },
                                }
                          }
                          style={{ left: x, top: y, x: '-50%', y: '-50%' }}
                        >
                          <motion.div
                            title={`${photo.authorName}${photo.questTitle ? ` · ${photo.questTitle}` : ''}`}
                            className="relative overflow-hidden rounded-2xl p-1.5"
                            style={{
                              background: 'rgba(255,255,255,0.4)',
                              backdropFilter: 'blur(30px) saturate(180%)',
                              WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                              border: '0.25px solid rgba(0,0,0,0.08)',
                            }}
                            animate={{
                              boxShadow: glowing
                                ? 'inset 0 0 30px -8px rgba(255,255,255,0.9), 0 0 36px 6px rgba(139,92,246,0.45)'
                                : 'inset 0 0 30px -8px rgba(255,255,255,0.9), 0 8px 28px rgba(0,0,0,0.12)',
                            }}
                            whileHover={{ scale: 1.08, zIndex: 40 }}
                            transition={{ duration: 0.35 }}
                          >
                            <div style={{ width: tile, height: tile }}>
                              <PhotoTile
                                photoUrl={photo.photoUrl}
                                glyph={photo.glyph}
                                alt={photo.alt}
                                className="h-full w-full rounded-xl"
                              />
                            </div>
                          </motion.div>
                        </motion.div>
                      );
                    })}

                    {/* teammates */}
                    {teammates.map((member, i) => {
                      const isIn = included.has(member.id);
                      if (pending && !isIn) return null;
                      const a = (i / Math.max(teammates.length, 1)) * Math.PI * 2 + angle * 0.7;
                      const r = isIn ? stage * 0.31 : stage * 0.2;
                      const x = round2(c + Math.cos(a) * r);
                      const y = round2(c + Math.sin(a) * r);
                      return (
                        <motion.button
                          key={member.id}
                          type="button"
                          onClick={() => toggleIncluded(member.id)}
                          aria-pressed={isIn}
                          aria-label={`${isIn ? 'Remove' : 'Include'} ${firstName(member)}`}
                          className="absolute z-20 flex flex-col items-center"
                          initial={{ opacity: 0, scale: 0.3 }}
                          animate={{ opacity: 1, scale: isIn ? 1.1 : 1 }}
                          exit={{ opacity: 0, scale: 0 }}
                          transition={{
                            opacity: { duration: 0.4 },
                            scale: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
                          }}
                          style={{ left: x, top: y, x: '-50%', y: '-50%' }}
                        >
                          <span
                            className={cn(
                              'rounded-full p-[3px] animate-smooth ease-liquid',
                              isIn
                                ? 'bg-primary shadow-[0_0_0_4px_rgba(155,135,245,0.25),0_8px_24px_rgba(155,135,245,0.45)]'
                                : 'bg-white/80 shadow-medium',
                            )}
                          >
                            <Avatar
                              name={member.name}
                              initials={member.initials}
                              accent={member.accent}
                              photoUrl={member.photoUrl}
                              size="lg"
                            />
                          </span>
                          <span
                            className={cn(
                              '-mt-2 rounded-full px-2 py-0.5 text-[9px] font-bold text-white',
                              isIn ? 'bg-primary shadow-soft' : 'bg-[rgba(100,100,120,0.8)]',
                            )}
                          >
                            {isIn ? 'Included' : 'Click to add'}
                          </span>
                        </motion.button>
                      );
                    })}
                  </>
                )}
              </div>
            </motion.div>
          )}

          {mode === 'thread' && (
            <motion.div
              key="thread"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_LIQUID }}
              className="absolute inset-0 flex flex-col"
            >
              <div className="flex shrink-0 justify-center pb-2 pt-1">
                <Orb size={64} active={pending} />
              </div>
              <div ref={threadRef} className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-1 pb-4">
                <div className="flex flex-col gap-4">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message}>
                      {message.actions?.map((action, i) => (
                        <ActionSummary key={`${message.id}-${i}`} action={action} />
                      ))}
                    </MessageBubble>
                  ))}
                  <AnimatePresence>{pending && <TypingBubble />}</AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {mode === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: EASE_LIQUID }}
              className="absolute inset-0 overflow-y-auto px-2 pb-4 pt-4"
            >
              {lastReply && (
                <div className="glass-card mb-4 flex items-start gap-3 rounded-2xl px-4 py-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Sparkles className="size-3 text-white" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] leading-relaxed text-foreground">{lastReply.content}</p>
                    {lastReply.actions
                      ?.filter((a): a is Extract<AgentAction, { type: 'windows-proposed' }> => a.type === 'windows-proposed')
                      .map((a, i) => (
                        <WindowChips key={i} windows={a.windows} />
                      ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {listed.map((quest, i) => {
                  const isNew = newQuest?.id === quest.id;
                  return (
                    <motion.div
                      key={quest.id}
                      layout
                      initial={isNew ? { opacity: 0, y: -40, scale: 0.94 } : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        duration: isNew ? 0.55 : 0.4,
                        delay: isNew ? 0 : 0.06 + 0.04 * i,
                        ease: isNew ? [0.34, 1.56, 0.64, 1] : EASE_LIQUID,
                      }}
                      className={cn('relative', isNew && 'rounded-3xl ring-2 ring-primary/40 ring-offset-2 ring-offset-white')}
                    >
                      {isNew && (
                        <motion.span
                          aria-hidden
                          className="pointer-events-none absolute -inset-1 rounded-[28px]"
                          initial={{ opacity: 0.9, boxShadow: '0 0 0 0 rgba(155,135,245,0.55)' }}
                          animate={{ opacity: 0, boxShadow: '0 0 0 22px rgba(155,135,245,0)' }}
                          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.25 }}
                        />
                      )}
                      {isNew && (
                        <span className="absolute -top-2.5 left-5 z-10 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white shadow-soft">
                          New
                        </span>
                      )}
                      <QuestCard
                        quest={quest}
                        streak={streaks[quest.id] ?? emptyStreak(quest)}
                        dense={quest.status !== 'active'}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ---------------------------------------------------------------- bar */}
      <div className="mx-auto w-full max-w-3xl shrink-0 pt-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
          className="glass-layer-1 shadow-strong relative flex h-14 items-center gap-3 rounded-full px-4"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 overflow-hidden rounded-t-full"
            style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.55), transparent)' }}
          />

          {includedMembers.length > 0 && (
            <span className="relative z-10 flex shrink-0 items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-medium text-foreground shadow-soft">
              <User className="size-3 text-muted-foreground" aria-hidden />
              {firstName(includedMembers[0]).toLowerCase()}
              {includedMembers.length > 1 ? ` +${includedMembers.length - 1}` : ''}
              <button
                type="button"
                onClick={() => setIncluded(new Set())}
                aria-label="Clear included teammates"
                className="ml-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          <label htmlFor="studio-input" className="sr-only">
            Talk to the agent
          </label>
          <input
            id="studio-input"
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={pending ? 'Thinking…' : PLACEHOLDER}
            disabled={pending}
            autoComplete="off"
            style={{ outline: 'none' }}
            className="relative z-10 min-w-0 flex-1 border-0 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/80 disabled:opacity-70"
          />

          {pending && (
            <span aria-hidden className="relative z-10 flex items-center gap-1 pr-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="block size-1 rounded-full bg-primary"
                  animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.16 }}
                />
              ))}
            </span>
          )}

          <button
            type="submit"
            aria-label="Send"
            disabled={pending || draft.trim().length === 0}
            className="animate-smooth relative z-10 grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-soft hover:opacity-90 disabled:opacity-40"
          >
            <Send className="size-4" aria-hidden />
          </button>
        </form>
        {error ? (
          <p role="alert" className="mt-1.5 text-center text-[12px] text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function WindowChips({ windows }: { windows: QuestWindow[] }) {
  if (windows.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {windows.map((w) => (
        <li
          key={w.id}
          className="rounded-full bg-primary/10 px-2.5 py-1 text-[11.5px] font-medium tabular-nums text-primary"
        >
          {relativeDay(w.date, dateKey(new Date()))} {clockTime(w.start)} · {durationLabel(w.minutes)}
        </li>
      ))}
    </ul>
  );
}

/** Compact result cards for the thread view; the slide-over has its own. */
function ActionSummary({ action }: { action: AgentAction }) {
  if (action.type === 'quest-drafted') {
    const rungs = [...action.quest.milestones].sort((a, b) => a.order - b.order);
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] px-3.5 py-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-primary">Quest drafted</p>
        <p className="mt-1 text-[13.5px] font-medium text-foreground">{action.quest.title}</p>
        <ol className="mt-2 space-y-1">
          {rungs.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <span className="grid size-4 place-items-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {m.order}
              </span>
              {m.title}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (action.type === 'windows-proposed') return <WindowChips windows={action.windows} />;
  return null;
}
