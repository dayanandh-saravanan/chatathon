import type {
  CalendarEvent,
  DayCapacity,
  Instant,
  Quest,
  QuestCategory,
  QuestWindow,
} from './types';
import {
  addMinutes,
  at,
  clamp,
  clockTime,
  dayLabel,
  fromDateKey,
  iso,
  minutesBetween,
  overlaps,
} from './time';

/**
 * The scheduler.
 *
 * Finds real gaps, then refuses most of them. Three rules do the work:
 *   1. Capacity gates the day — a depleted day gets nothing, by design.
 *   2. Every session needs a decompression buffer after the last meeting.
 *   3. Rest days are protected, because the failure mode is burning out in
 *      week one and never coming back.
 */

/** Never propose anything shorter than this; it is not a real session. */
const MIN_SESSION_MINUTES = 25;
/** Nothing starts before this or ends after it. Evenings are not infinite. */
const EARLIEST_HOUR = 6;
const LATEST_END_HOUR = 22;
/** Minutes of breathing room required between the last meeting and a session. */
const DECOMPRESSION_MINUTES = { depleted: 120, steady: 60, primed: 30 } as const;
/** Minimum rest days per rolling week, per quest. */
const MIN_REST_DAYS_PER_WEEK = 2;

export interface FreeWindow {
  start: Date;
  end: Date;
  minutes: number;
  /** Minutes between the previous work event and this window. */
  bufferAfterWork: number;
}

/** Category-specific circadian preference, scored 0–1 by start hour. */
const TIME_FIT: Record<QuestCategory, (hour: number) => number> = {
  fitness: (h) => (h >= 6 && h <= 9 ? 1 : h >= 16 && h <= 19 ? 0.92 : h >= 20 ? 0.45 : 0.6),
  music: (h) => (h >= 17 && h <= 21 ? 1 : h >= 10 && h <= 16 ? 0.7 : 0.5),
  craft: (h) => (h >= 18 && h <= 21 ? 1 : h >= 9 && h <= 17 ? 0.7 : 0.5),
  art: (h) => (h >= 18 && h <= 21 ? 0.98 : h >= 7 && h <= 10 ? 0.85 : 0.65),
  cooking: (h) => (h >= 16 && h <= 19 ? 1 : h >= 11 && h <= 13 ? 0.8 : 0.45),
  outdoors: (h) => (h >= 7 && h <= 11 ? 1 : h >= 15 && h <= 18 ? 0.9 : 0.3),
  learning: (h) => (h >= 7 && h <= 10 ? 1 : h >= 19 && h <= 21 ? 0.8 : 0.6),
  other: (h) => (h >= 17 && h <= 21 ? 0.9 : 0.7),
};

/**
 * Gaps in a single day that are long enough to matter. Existing quest blocks
 * count as busy so the agent never double-books its own suggestions.
 */
export function findFreeWindows(
  events: CalendarEvent[],
  date: string,
  minMinutes = MIN_SESSION_MINUTES,
): FreeWindow[] {
  const day = fromDateKey(date);
  const dayStart = at(day, EARLIEST_HOUR);
  const dayEnd = at(day, LATEST_END_HOUR);

  const busy = events
    .map((e) => ({ start: new Date(e.start), end: new Date(e.end), kind: e.kind }))
    .filter((e) => overlaps(e.start, e.end, dayStart, dayEnd))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const windows: FreeWindow[] = [];
  let cursor = dayStart;
  let lastWorkEnd: Date | null = null;

  for (const block of busy) {
    if (block.start > cursor) {
      const minutes = minutesBetween(cursor, block.start);
      if (minutes >= minMinutes) {
        windows.push({
          start: cursor,
          end: new Date(block.start),
          minutes,
          bufferAfterWork: lastWorkEnd ? minutesBetween(lastWorkEnd, cursor) : Infinity,
        });
      }
    }
    if (block.end > cursor) cursor = new Date(block.end);
    if (block.kind === 'meeting' || block.kind === 'focus' || block.kind === 'commute') {
      lastWorkEnd = new Date(block.end);
    }
  }

  if (cursor < dayEnd) {
    const minutes = minutesBetween(cursor, dayEnd);
    if (minutes >= minMinutes) {
      windows.push({
        start: cursor,
        end: dayEnd,
        minutes,
        bufferAfterWork: lastWorkEnd ? minutesBetween(lastWorkEnd, cursor) : Infinity,
      });
    }
  }

  return windows;
}

export interface ScoredSlot {
  start: Date;
  end: Date;
  minutes: number;
  score: number;
  rationale: string[];
  risks: string[];
}

function scoreSlot(
  quest: Quest,
  capacity: DayCapacity,
  free: FreeWindow,
  sessionMinutes: number,
): ScoredSlot | null {
  const required = DECOMPRESSION_MINUTES[capacity.band];
  // Start after the buffer, but never sooner than the window itself opens.
  const earliest =
    free.bufferAfterWork === Infinity
      ? free.start
      : addMinutes(free.start, Math.max(0, required - free.bufferAfterWork));

  const available = minutesBetween(earliest, free.end);
  if (available < MIN_SESSION_MINUTES) return null;

  const minutes = Math.min(sessionMinutes, available, capacity.dailyBudgetMinutes);
  if (minutes < MIN_SESSION_MINUTES) return null;

  const start = earliest;
  const end = addMinutes(start, minutes);
  if (end.getHours() >= LATEST_END_HOUR && end.getMinutes() > 0) return null;

  const rationale: string[] = [];
  const risks: string[] = [];

  const capacityComponent = capacity.score / 100;
  const timeComponent = TIME_FIT[quest.category](start.getHours());
  // A session that fits the window with slack is better than one that fills it exactly.
  const roomComponent = clamp(available / (sessionMinutes * 1.6), 0.4, 1);
  const bufferComponent =
    free.bufferAfterWork === Infinity ? 1 : clamp(free.bufferAfterWork / (required * 1.5), 0.3, 1);

  const score = Math.round(
    (capacityComponent * 0.4 +
      timeComponent * 0.27 +
      roomComponent * 0.18 +
      bufferComponent * 0.15) *
      100,
  );

  rationale.push(
    `${dayLabel(start)} capacity ${capacity.score}/100 — ${capacity.band}.`,
  );
  if (free.bufferAfterWork !== Infinity) {
    rationale.push(
      `${free.bufferAfterWork}m after your last meeting, past the ${required}m decompression floor.`,
    );
  } else {
    rationale.push('No work blocks ahead of it — you arrive at this one fresh.');
  }
  if (timeComponent >= 0.9) {
    rationale.push(`${clockTime(start)} is when ${quest.category} actually sticks for you.`);
  }
  if (minutes < quest.sessionMinutes) {
    rationale.push(
      `Trimmed to ${minutes}m — that is the whole budget today, and a short session you finish beats a long one you bail on.`,
    );
  }

  if (capacity.band === 'steady') {
    risks.push('Steady, not primed. If it slips, SideQuest will not reschedule it tonight.');
  }
  if (start.getHours() >= 20) {
    risks.push('Late start. Pushed any later and it competes with sleep.');
  }
  if (capacity.longestMeetingRun >= 180) {
    risks.push(`${capacity.longestMeetingRun}m unbroken meeting run earlier — expect lower focus.`);
  }

  return { start, end, minutes, score, rationale, risks };
}

export interface ProposalInput {
  quest: Quest;
  /** Capacity for each candidate day, in chronological order. */
  capacities: DayCapacity[];
  /** All events for those days, including already-accepted quest blocks. */
  events: CalendarEvent[];
  /** Windows already on the books, so rest days are counted honestly. */
  existingWindows: QuestWindow[];
  now: Date;
  /** How many blocks to hand back. */
  limit?: number;
}

/**
 * Propose the next few sessions for one quest.
 *
 * Deliberately conservative: at most one block per day, rest days enforced,
 * and the weekly target treated as a ceiling the agent stays under rather than
 * a quota it fills.
 */
export function proposeWindows(input: ProposalInput): QuestWindow[] {
  const { quest, capacities, events, existingWindows, now } = input;
  const limit = input.limit ?? 3;

  const candidateDays = capacities.filter((c) => c.dailyBudgetMinutes > 0);
  const takenDays = new Set(
    existingWindows
      .filter((w) => w.status === 'accepted' || w.status === 'proposed')
      .map((w) => w.date),
  );

  const scored: Array<ScoredSlot & { date: string }> = [];

  for (const capacity of candidateDays) {
    if (takenDays.has(capacity.date)) continue;

    const dayEvents = events.filter((e) => e.start.slice(0, 10) === capacity.date);
    const free = findFreeWindows(dayEvents, capacity.date);

    let best: ScoredSlot | null = null;
    for (const window of free) {
      if (window.end <= now) continue;
      const slot = scoreSlot(quest, capacity, window, quest.sessionMinutes);
      if (slot && (!best || slot.score > best.score)) best = slot;
    }
    if (best) scored.push({ ...best, date: capacity.date });
  }

  scored.sort((a, b) => b.score - a.score);

  const chosen: Array<ScoredSlot & { date: string }> = [];
  let weeklyMinutes = existingWindows
    .filter((w) => w.status === 'accepted' || w.status === 'completed')
    .reduce((sum, w) => sum + w.minutes, 0);

  for (const slot of scored) {
    if (chosen.length >= limit) break;
    if (weeklyMinutes + slot.minutes > quest.weeklyMinutesTarget) continue;

    const scheduledDays = new Set([...takenDays, ...chosen.map((c) => c.date)]);
    const restDays = 7 - scheduledDays.size - 1;
    if (restDays < MIN_REST_DAYS_PER_WEEK) break;

    chosen.push(slot);
    weeklyMinutes += slot.minutes;
  }

  chosen.sort((a, b) => a.start.getTime() - b.start.getTime());

  const currentMilestone = quest.milestones.find((m) => m.status === 'current');

  return chosen.map((slot, i) => ({
    id: `w_${quest.id}_${slot.date}_${slot.start.getHours()}${slot.start.getMinutes()}`,
    ownerId: quest.ownerId,
    questId: quest.id,
    milestoneId: currentMilestone?.id,
    date: slot.date,
    start: iso(slot.start),
    end: iso(slot.end),
    minutes: slot.minutes,
    score: slot.score,
    rationale: slot.rationale,
    risks: slot.risks,
    status: 'proposed' as const,
    createdAt: iso(new Date(now.getTime() + i)),
  }));
}

/**
 * Why the agent declined to schedule at all. Saying nothing looks like a bug;
 * saying "you are cooked, take the night" is the product.
 */
export function explainNoProposal(
  quest: Quest,
  capacities: DayCapacity[],
): { title: string; detail: string } {
  const depleted = capacities.filter((c) => c.band === 'depleted');
  if (depleted.length === capacities.length && capacities.length > 0) {
    return {
      title: 'Nothing scheduled — on purpose',
      detail: `Every day this week reads depleted. Booking ${quest.title.toLowerCase()} into that is how the habit dies. SideQuest will check again tomorrow.`,
    };
  }
  return {
    title: 'No honest window found',
    detail: `There is free time, but none of it clears the decompression buffer after your meetings. A session wedged in there gets skipped.`,
  };
}

export function windowInstantRange(w: QuestWindow): { start: Instant; end: Instant } {
  return { start: w.start, end: w.end };
}
