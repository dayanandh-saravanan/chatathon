import type {
  CalendarEvent,
  DateKey,
  DayCapacity,
  Milestone,
  Quest,
  QuestCategory,
  QuestWindow,
  UserId,
} from '@/lib/domain/types';
import { explainNoProposal, proposeWindows } from '@/lib/domain/scheduling';
import {
  addDays,
  at,
  clockTime,
  dateKey,
  durationLabel,
  fromDateKey,
  iso,
  relativeDay,
} from '@/lib/domain/time';

/**
 * The deterministic half of the agent.
 *
 * Nothing in this file needs a network, a key, or a model. The LLM can only
 * ever improve the wording of what is decided here, which is why the product
 * demos identically with `ANTHROPIC_API_KEY` unset.
 */

export interface MilestoneDraft {
  title: string;
  detail: string;
  estimatedSessions: number;
}

/* -------------------------------------------------------------------------- */
/* Category                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ordered on purpose: the first table to match wins, so the narrower category
 * has to come before the broader one. "Build a keyboard" is craft; "learn
 * piano" is music — which is why `keyboard` lives in craft and not in music.
 */
const CATEGORY_KEYWORDS: ReadonlyArray<readonly [QuestCategory, readonly string[]]> = [
  [
    'music',
    ['guitar', 'piano', 'sing', 'song', 'band', 'drum', 'bass', 'violin', 'cello',
      'ukulele', 'music', 'jazz', 'choir', 'synth', 'produce a track', 'dj', 'trumpet', 'sax'],
  ],
  [
    'fitness',
    ['run', 'marathon', 'lift', 'gym', 'swim', 'cycl', 'bike', 'yoga', 'pull-up',
      'pushup', 'push-up', 'strength', 'fitness', 'row', 'box', 'soccer', 'basketball',
      'tennis', 'squat', 'deadlift', 'pilates', 'martial art', 'jiu jitsu', 'climb',
      'skate', 'dance', 'golf', 'stretch', 'mobility'],
  ],
  [
    'craft',
    ['keyboard', 'solder', 'woodwork', 'carpentry', 'knit', 'crochet', 'sew', 'quilt',
      'pottery', 'ceramic', 'leather', 'model kit', 'craft', 'restore', 'repair',
      'build a', '3d print', 'lathe', 'blacksmith'],
  ],
  [
    'outdoors',
    ['hike', 'camp', 'trail', 'kayak', 'canoe', 'surf', 'ski', 'snowboard', 'garden',
      'bird', 'fish', 'outdoors', 'backpack', 'sail', 'forage'],
  ],
  [
    'cooking',
    ['cook', 'bake', 'recipe', 'pasta', 'bread', 'sourdough', 'grill', 'kitchen',
      'ferment', 'cocktail', 'coffee', 'barista', 'pastry', 'butcher'],
  ],
  [
    'art',
    ['draw', 'paint', 'sketch', 'photo', 'film', 'illustrat', 'animat', 'sculpt',
      'poetry', 'calligraphy', 'printmak', 'collage', 'art'],
  ],
  [
    'learning',
    ['learn', 'study', 'language', 'spanish', 'french', 'japanese', 'mandarin',
      'chinese', 'german', 'italian', 'korean', 'portuguese', 'read', 'chess',
      'course', 'math', 'history', 'astronomy', 'write'],
  ],
];

/** Word-boundary match, so "brunch" never reads as "run". */
function mentions(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}`, 'i').test(text);
}

export function inferCategory(goalText: string): QuestCategory {
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => mentions(goalText, k))) return category;
  }
  return 'other';
}

/* -------------------------------------------------------------------------- */
/* Shape of the commitment                                                     */
/* -------------------------------------------------------------------------- */

/** [weeksToTarget, weeklyMinutes, sessionMinutes] per category. */
const CATEGORY_SHAPE: Record<QuestCategory, readonly [number, number, number]> = {
  music: [12, 120, 45],
  fitness: [14, 180, 55],
  craft: [8, 90, 45],
  outdoors: [10, 150, 90],
  cooking: [12, 150, 60],
  learning: [16, 100, 30],
  art: [10, 120, 50],
  other: [10, 120, 45],
};

/** `3 months`, `six weeks`, `in a year` — people say the horizon out loud. */
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12,
};

function parseHorizonWeeks(goalText: string): number | null {
  const match = goalText
    .toLowerCase()
    .match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s*(week|month|year)s?/);
  if (!match) return null;
  const count = Number(match[1]) || WORD_NUMBERS[match[1]];
  if (!count) return null;
  const weeks = match[2] === 'week' ? count : match[2] === 'month' ? count * 4 : count * 52;
  return Math.min(78, Math.max(2, weeks));
}

export function inferTargetDate(
  goalText: string,
  category: QuestCategory,
  now: Date = new Date(),
): DateKey {
  const weeks = parseHorizonWeeks(goalText) ?? CATEGORY_SHAPE[category][0];
  return dateKey(addDays(now, weeks * 7));
}

/** `45 minutes a day`, `two hours a week` — honour it when they say it. */
function parseMinutes(goalText: string): { perWeek: number | null; perSession: number | null } {
  const text = goalText.toLowerCase();
  const match = text.match(
    /(\d+)\s*(minute|min|hour|hr)s?\s*(?:a|per|each)\s*(day|week|session|sitting)/,
  );
  if (!match) return { perWeek: null, perSession: null };

  const raw = Number(match[1]);
  const minutes = match[2].startsWith('h') ? raw * 60 : raw;
  if (match[3] === 'week') return { perWeek: minutes, perSession: null };
  if (match[3] === 'day') return { perWeek: minutes * 5, perSession: minutes };
  return { perWeek: null, perSession: minutes };
}

export function inferSessionMinutes(goalText: string, category: QuestCategory): number {
  const stated = parseMinutes(goalText).perSession;
  const minutes = stated ?? CATEGORY_SHAPE[category][2];
  // Below 25 the scheduler will not place it at all; above 120 it stops being a habit.
  return Math.min(120, Math.max(25, Math.round(minutes / 5) * 5));
}

export function inferWeeklyMinutes(
  goalText: string,
  category: QuestCategory,
  sessionMinutes: number,
): number {
  const stated = parseMinutes(goalText).perWeek;
  const minutes = stated ?? CATEGORY_SHAPE[category][1];
  // A ceiling below one session is not a ceiling, it is a block on the quest.
  return Math.min(600, Math.max(sessionMinutes * 2, Math.round(minutes / 10) * 10));
}

/* -------------------------------------------------------------------------- */
/* Milestones                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Generic ladders, one per category. Each rung is a thing you can finish, and
 * the last rung always involves another person — finishing alone is how these
 * quietly stop mattering. `{goal}` is replaced with the member's own words.
 */
const LADDERS: Record<QuestCategory, readonly MilestoneDraft[]> = {
  music: [
    { title: 'Out of the case, in reach', detail: 'Tuned and on a stand where you walk past it. Ten minutes counts as a session.', estimatedSessions: 4 },
    { title: 'One piece, slow and clean', detail: 'Half speed with a metronome, no stopping to fix mistakes.', estimatedSessions: 8 },
    { title: 'Up to tempo, start to finish', detail: 'Same piece, real speed, no restarts.', estimatedSessions: 8 },
    { title: 'Play it for one person', detail: 'Someone else in the room. That is the whole milestone: {goal}.', estimatedSessions: 4 },
  ],
  fitness: [
    { title: 'Four easy weeks', detail: 'Short and comfortable, no pace pressure. The only goal is showing up.', estimatedSessions: 10 },
    { title: 'One honest benchmark', detail: 'Measure where you actually are, once, and write it down.', estimatedSessions: 4 },
    { title: 'Build the middle', detail: 'Add a little each week, hold the easy days easy.', estimatedSessions: 10 },
    { title: 'Do the thing', detail: 'The real attempt: {goal}.', estimatedSessions: 4 },
  ],
  craft: [
    { title: 'Everything on the bench', detail: 'Parts, tools and light in one place so starting costs nothing.', estimatedSessions: 2 },
    { title: 'Practise on a scrap', detail: 'Make the mistakes on something you do not mind ruining.', estimatedSessions: 4 },
    { title: 'Build the real one', detail: 'Slow, in order, no shortcuts on the part that scares you.', estimatedSessions: 6 },
    { title: 'Finish and use it', detail: 'Done enough to live with: {goal}.', estimatedSessions: 3 },
  ],
  outdoors: [
    { title: 'Gear sorted and packed', detail: 'One bag, ready to grab. The barrier is never the activity.', estimatedSessions: 2 },
    { title: 'Three short outings', detail: 'Close to home, low stakes, whatever the weather does.', estimatedSessions: 6 },
    { title: 'One full day out', detail: 'Long enough that you have to plan food and water.', estimatedSessions: 4 },
    { title: 'The one you wanted', detail: 'The trip you had in mind when you said: {goal}.', estimatedSessions: 3 },
  ],
  cooking: [
    { title: 'Three repeats of one dish', detail: 'Same recipe until it stops needing the recipe.', estimatedSessions: 4 },
    { title: 'Learn the technique underneath', detail: 'The method, not the dish — it transfers to everything else.', estimatedSessions: 5 },
    { title: 'Cook without the instructions', detail: 'Same result, from memory, adjusting as you go.', estimatedSessions: 4 },
    { title: 'Feed someone', detail: 'Plated, on a table, for another person: {goal}.', estimatedSessions: 3 },
  ],
  learning: [
    { title: 'Twenty minutes, most days', detail: 'A small fixed slot beats an ambitious one you cancel.', estimatedSessions: 8 },
    { title: 'Use it badly, on purpose', detail: 'First real attempt, mistakes included. Fluency is downstream of embarrassment.', estimatedSessions: 8 },
    { title: 'Hold your own for ten minutes', detail: 'Unscripted, no falling back to what is comfortable.', estimatedSessions: 6 },
    { title: 'The thing you set out to do', detail: '{goal}.', estimatedSessions: 4 },
  ],
  art: [
    { title: 'Make twenty bad ones', detail: 'Quantity first. Nothing gets shown, nothing gets judged.', estimatedSessions: 6 },
    { title: 'Copy something you admire', detail: 'Closely, on purpose. You learn more from it than from a blank page.', estimatedSessions: 6 },
    { title: 'Make one you meant', detail: 'Your own subject, start to finish, finished even if it is not right.', estimatedSessions: 5 },
    { title: 'Put it where people see it', detail: 'A wall, a print, a post: {goal}.', estimatedSessions: 3 },
  ],
  other: [
    { title: 'Start smaller than feels useful', detail: 'One short session this week. That is the whole rung.', estimatedSessions: 4 },
    { title: 'Three weeks in a row', detail: 'Consistency before intensity — this is the rung most people skip.', estimatedSessions: 6 },
    { title: 'Go deeper on one part', detail: 'Pick the part that is hardest and spend real time on it.', estimatedSessions: 6 },
    { title: 'Finish it in public', detail: 'Tell someone you did it: {goal}.', estimatedSessions: 4 },
  ],
};

/** Their sentence, trimmed to something that can sit mid-sentence. */
function goalPhrase(goalText: string): string {
  const cleaned = goalText.trim().replace(/[.!?]+$/, '');
  const stripped = cleaned.replace(
    /^(i\s+(?:really\s+)?want\s+to|i'?d\s+like\s+to|i\s+would\s+like\s+to|help\s+me|i\s+need\s+to|i\s+should)\s+/i,
    '',
  );
  const phrase = stripped.length > 0 ? stripped : cleaned;
  return phrase.length > 90 ? `${phrase.slice(0, 87).trimEnd()}...` : phrase;
}

/** A title, not a sentence: their words with the throat-clearing removed. */
export function titleFromGoal(goalText: string): string {
  const phrase = goalPhrase(goalText);
  const title = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  return title.length > 70 ? `${title.slice(0, 67).trimEnd()}...` : title;
}

export function fallbackMilestones(
  goalText: string,
  category: QuestCategory,
): MilestoneDraft[] {
  const phrase = goalPhrase(goalText).toLowerCase();
  return LADDERS[category].map((rung) => ({
    ...rung,
    detail: rung.detail.replace('{goal}', phrase),
  }));
}

/** First rung is live, the rest are locked — a ladder, not a checklist. */
export function toMilestones(questId: string, drafts: MilestoneDraft[]): Milestone[] {
  return drafts.map((draft, i) => ({
    id: `${questId}_m${i + 1}`,
    questId,
    order: i + 1,
    title: draft.title,
    detail: draft.detail,
    estimatedSessions: draft.estimatedSessions,
    sessionsDone: 0,
    status: i === 0 ? ('current' as const) : ('locked' as const),
  }));
}

/* -------------------------------------------------------------------------- */
/* Searching for the shape of the day                                          */
/* -------------------------------------------------------------------------- */

/** Mirrors the scheduler's own floor; nothing is ever placed before this hour. */
const DAY_OPENS_AT = 6;

/**
 * Hours the agent is willing to treat as "the day opens here".
 *
 * The scheduler scores the *start* of each gap it finds, so on an empty
 * Saturday the only candidate it can see is 6am — and it will hand back a 6am
 * guitar block that nobody plays. Rather than second-guess its scoring, the
 * agent shows it the same day cut several ways and keeps whichever shape its
 * own scoring function likes best. 6 is in the list, so the search can only
 * improve on the unconstrained answer, never lose to it.
 */
const DAY_OPEN_HOURS = [6, 8, 10, 12, 15, 17, 18, 19, 20] as const;

/**
 * Time that is real but not on any calendar: hours already spent today, and
 * the part of the day the agent has decided not to open with. Marked
 * `personal` so it occupies the day without counting as work — work would
 * impose a decompression buffer the member never actually earned.
 */
function closedHours(
  ownerId: UserId,
  capacities: DayCapacity[],
  openAtHour: number,
  now: Date,
): CalendarEvent[] {
  const todayKey = dateKey(now);
  const events: CalendarEvent[] = [];

  for (const capacity of capacities) {
    const spentToday =
      capacity.date === todayKey ? now.getHours() + (now.getMinutes() > 0 ? 1 : 0) : 0;
    const closesAt = Math.max(openAtHour, spentToday);
    if (closesAt <= DAY_OPENS_AT) continue;

    const day = fromDateKey(capacity.date);
    events.push({
      id: `closed_${capacity.date}_${closesAt}`,
      ownerId,
      title: 'Before the day opens',
      kind: 'personal',
      start: iso(at(day, DAY_OPENS_AT)),
      end: iso(at(day, Math.min(24, closesAt))),
    });
  }

  return events;
}

export interface ProposalSearch {
  quest: Quest;
  capacities: DayCapacity[];
  events: CalendarEvent[];
  existingWindows: QuestWindow[];
  now: Date;
  limit?: number;
}

/**
 * Propose blocks for one quest. The decision is still entirely the domain
 * layer's — this only makes sure it is asked the question more than one way,
 * then drops anything that has already happened.
 */
export function searchProposals(input: ProposalSearch): QuestWindow[] {
  const { quest, capacities, events, existingWindows, now } = input;
  let best: QuestWindow[] = [];
  let bestScore = -1;

  for (const hour of DAY_OPEN_HOURS) {
    const windows = proposeWindows({
      quest,
      capacities,
      events: [...events, ...closedHours(quest.ownerId, capacities, hour, now)],
      existingWindows,
      now,
      limit: input.limit ?? 3,
    }).filter((w) => new Date(w.start).getTime() > now.getTime());

    const total = windows.reduce((sum, w) => sum + w.score, 0);
    if (total > bestScore) {
      bestScore = total;
      best = windows;
    }
  }

  return best;
}

/* -------------------------------------------------------------------------- */
/* Explaining the plan                                                         */
/* -------------------------------------------------------------------------- */

const COUNT_WORDS = ['no', 'One', 'Two', 'Three', 'Four', 'Five'];

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

function blockPhrase(window: QuestWindow, todayKey: DateKey): string {
  return `${relativeDay(window.date, todayKey)} ${clockTime(window.start)} for ${durationLabel(window.minutes)}`;
}

function joinPhrases(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * The copy that ships with a plan — including the plan that is empty.
 *
 * Saying nothing when the answer is "nothing" looks like a bug. Saying "you are
 * cooked, here is the number, I am leaving tonight alone" is the product.
 */
export function describePlan(
  windows: QuestWindow[],
  quest: Quest,
  horizon: DayCapacity[],
): { title: string; note: string } {
  const today = horizon[0];
  const todayKey = today?.date ?? dateKey(new Date());

  if (windows.length === 0) {
    const refusal = explainNoProposal(quest, horizon);
    const opener =
      today && today.band === 'depleted'
        ? `Capacity is ${today.score} out of 100 today, so tonight stays empty. `
        : '';
    return { title: refusal.title, note: `${opener}${refusal.detail}` };
  }

  const totalMinutes = windows.reduce((sum, w) => sum + w.minutes, 0);
  const best = windows.reduce((a, b) => (b.score > a.score ? b : a));
  const hasBlockToday = windows.some((w) => w.date === todayKey);

  const sentences: string[] = [];

  // The refusal comes first even on a successful plan — it is the harder half
  // of the answer and the part a calendar tool would quietly skip.
  if (today && today.band === 'depleted' && !hasBlockToday) {
    sentences.push(
      `Nothing today — capacity is ${today.score} out of 100, and a block you skip costs more than a night off.`,
    );
  }

  sentences.push(
    `${countWord(windows.length)} ${windows.length === 1 ? 'block' : 'blocks'} held: ${joinPhrases(
      windows.map((w) => blockPhrase(w, todayKey)),
    )}.`,
  );
  sentences.push(
    `That is ${durationLabel(totalMinutes)} against your ${durationLabel(quest.weeklyMinutesTarget)} weekly ceiling, with rest days either side.`,
  );
  if (windows.length > 1) {
    sentences.push(
      `${relativeDay(best.date, todayKey)} is the strongest fit at ${best.score} out of 100.`,
    );
  }

  // Short, and parallel with the refusal title — the detail belongs in the note.
  return {
    title: `${countWord(windows.length)} ${windows.length === 1 ? 'block' : 'blocks'} held`,
    note: sentences.join(' '),
  };
}
