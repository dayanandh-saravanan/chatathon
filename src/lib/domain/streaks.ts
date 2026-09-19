import type { Post, Quest, QuestStreak, QuestWindow, TeamPulse, DayCapacity, TeamMember } from './types';
import { DAY, addDays, dateKey, daysAgo, startOfWeek } from './time';

/**
 * Streaks are counted in **weeks**, not days.
 *
 * A daily streak punishes a normal life: one bad Tuesday and the counter you
 * have been protecting for a month reads zero. Weekly streaks survive a bad
 * Tuesday, which is the entire point of building a habit that lasts.
 */

export function completedSessions(
  windows: QuestWindow[],
  questId: string,
): QuestWindow[] {
  return windows
    .filter((w) => w.questId === questId && w.status === 'completed')
    .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
}

export function computeStreak(
  quest: Quest,
  windows: QuestWindow[],
  now: Date,
): QuestStreak {
  const done = completedSessions(windows, quest.id);

  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = addDays(thisWeekStart, -7);

  const inRange = (w: QuestWindow, from: Date, to: Date) => {
    const t = new Date(w.start).getTime();
    return t >= from.getTime() && t < to.getTime();
  };

  const thisWeek = done.filter((w) => inRange(w, thisWeekStart, addDays(thisWeekStart, 7)));
  const lastWeek = done.filter((w) => inRange(w, lastWeekStart, thisWeekStart));

  const minutesThisWeek = thisWeek.reduce((s, w) => s + w.minutes, 0);
  const minutesLastWeek = lastWeek.reduce((s, w) => s + w.minutes, 0);

  // Walk back week by week until we hit one with no completed session.
  let weeks = 0;
  for (let i = 0; i < 52; i += 1) {
    const from = addDays(thisWeekStart, -7 * i);
    const to = addDays(from, 7);
    const hit = done.some((w) => inRange(w, from, to));
    if (hit) {
      weeks += 1;
      continue;
    }
    // The current week not having happened *yet* should not break a streak.
    if (i === 0) continue;
    break;
  }

  const quietDays = done.length > 0 ? daysAgo(done[0].start, now) : null;
  const adherence =
    quest.weeklyMinutesTarget > 0
      ? Math.min(1.5, minutesThisWeek / quest.weeklyMinutesTarget)
      : 0;

  // A quest with no sessions yet is only "quiet" once it has had a fair chance:
  // ten days after it was set up. Before that it is simply new.
  const ageDays = daysAgo(quest.createdAt, now);
  const silent = quietDays === null ? ageDays >= 10 : quietDays >= 10;

  let health: QuestStreak['health'];
  if (silent) health = 'quiet';
  else if (adherence >= 0.8) health = 'thriving';
  else if (adherence >= 0.35 || quietDays <= 4) health = 'steady';
  else health = 'slipping';

  return {
    questId: quest.id,
    weeks,
    quietDays,
    minutesThisWeek,
    minutesLastWeek,
    sessionsThisWeek: thisWeek.length,
    adherence: Math.round(adherence * 100) / 100,
    health,
  };
}

export const HEALTH_COPY: Record<QuestStreak['health'], { label: string; tone: string }> = {
  thriving: { label: 'Thriving', tone: 'success' },
  steady: { label: 'Steady', tone: 'primary' },
  slipping: { label: 'Slipping', tone: 'warning' },
  quiet: { label: 'Gone quiet', tone: 'danger' },
};

export function computeTeamPulse(
  members: TeamMember[],
  quests: Quest[],
  windows: QuestWindow[],
  capacities: DayCapacity[],
  now: Date,
): TeamPulse {
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = addDays(thisWeekStart, -7);

  const completed = windows.filter((w) => w.status === 'completed');
  const inWeek = (w: QuestWindow, from: Date) => {
    const t = new Date(w.start).getTime();
    return t >= from.getTime() && t < from.getTime() + 7 * DAY;
  };

  const thisWeek = completed.filter((w) => inWeek(w, thisWeekStart));
  const lastWeek = completed.filter((w) => inWeek(w, lastWeekStart));

  const streaks = quests.map((q) => computeStreak(q, windows, now));

  return {
    weekStart: dateKey(thisWeekStart),
    minutesReclaimed: thisWeek.reduce((s, w) => s + w.minutes, 0),
    minutesLastWeek: lastWeek.reduce((s, w) => s + w.minutes, 0),
    participating: new Set(thisWeek.map((w) => w.ownerId)).size,
    memberCount: members.length,
    questsThriving: streaks.filter((s) => s.health === 'thriving').length,
    questsQuiet: streaks.filter((s) => s.health === 'quiet').length,
    averageCapacity:
      capacities.length === 0
        ? 0
        : Math.round(capacities.reduce((s, c) => s + c.score, 0) / capacities.length),
  };
}

/** Sessions a member logged publicly, used to cross-check streaks against the feed. */
export function postsForQuest(posts: Post[], questId: string): Post[] {
  return posts
    .filter((p) => p.questId === questId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
