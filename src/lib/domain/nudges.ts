import type {
  DayCapacity,
  Nudge,
  Post,
  Quest,
  QuestStreak,
  QuestWindow,
  TeamMember,
  UserId,
} from './types';
import { iso, timeAgo } from './time';

/**
 * The care layer.
 *
 * The team rejected leaderboards on purpose: seeing everyone else's progress
 * while you are underwater makes you quit, not try harder. So SideQuest never
 * ranks anybody. When someone goes quiet it tells *one teammate*, privately,
 * and asks them to check in like a person.
 */

export interface NudgeInput {
  members: TeamMember[];
  quests: Quest[];
  streaks: Record<string, QuestStreak>;
  windows: QuestWindow[];
  posts: Post[];
  capacities: Record<UserId, DayCapacity>;
  /** The member the nudges are being generated *for* — they are the one asked to act. */
  viewerId: UserId;
  now: Date;
}

/** Who should reach out: same-category buddy first, then longest-tenured teammate. */
function pickBuddy(
  aboutUserId: UserId,
  quest: Quest,
  quests: Quest[],
  members: TeamMember[],
  viewerId: UserId,
): UserId {
  if (viewerId !== aboutUserId) return viewerId;
  const sameCategory = quests.find(
    (q) => q.category === quest.category && q.ownerId !== aboutUserId && q.status === 'active',
  );
  if (sameCategory) return sameCategory.ownerId;
  const other = members.find((m) => m.id !== aboutUserId);
  return other?.id ?? aboutUserId;
}

export function generateNudges(input: NudgeInput): Nudge[] {
  const { members, quests, streaks, windows, posts, capacities, viewerId, now } = input;
  const byId = new Map(members.map((m) => [m.id, m]));
  const nudges: Nudge[] = [];

  for (const quest of quests) {
    if (quest.status !== 'active') continue;
    const streak = streaks[quest.id];
    if (!streak) continue;

    const owner = byId.get(quest.ownerId);
    if (!owner) continue;

    const capacity = capacities[quest.ownerId];
    const lastPost = posts
      .filter((p) => p.questId === quest.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    // 1. Gone quiet → ask a teammate to check in. Never announce it.
    if (streak.health === 'quiet' && quest.ownerId !== viewerId) {
      const reasons = [
        streak.quietDays === null
          ? 'No sessions logged since they set this quest up.'
          : `${streak.quietDays} days since their last session.`,
        `${streak.weeks === 0 ? 'No' : streak.weeks}-week streak ended.`,
      ];
      if (capacity && capacity.band === 'depleted') {
        reasons.push(`Their calendar has been brutal — capacity ${capacity.score}/100 today.`);
      }
      if (lastPost) reasons.push(`Last posted ${timeAgo(lastPost.createdAt, now)}.`);

      nudges.push({
        id: `n_checkin_${quest.id}`,
        kind: 'check-in',
        aboutUserId: quest.ownerId,
        toUserId: pickBuddy(quest.ownerId, quest, quests, members, viewerId),
        questId: quest.id,
        title: `Check in on ${owner.name.split(' ')[0]}`,
        message: `${owner.name.split(' ')[0]} hasn't touched "${quest.title}" in a while and their weeks have been packed. Not a nag — just ask how it's going.`,
        reasons,
        createdAt: iso(now),
        status: 'open',
      });
    }

    // 2. Overshooting the target → the week-one burnout pattern, caught early.
    if (streak.adherence >= 1.4 && quest.ownerId === viewerId) {
      nudges.push({
        id: `n_rest_${quest.id}`,
        kind: 'rest',
        aboutUserId: quest.ownerId,
        toUserId: viewerId,
        questId: quest.id,
        title: 'You are ahead of your own plan',
        message: `${streak.minutesThisWeek}m this week against a ${quest.weeklyMinutesTarget}m target. This is exactly how hobbies die in week three. SideQuest is holding the next block back.`,
        reasons: [
          `${Math.round(streak.adherence * 100)}% of your weekly target, with days left.`,
          `${streak.sessionsThisWeek} sessions already logged.`,
        ],
        createdAt: iso(now),
        status: 'open',
      });
    }

    // 3. An accepted block about to be eaten by the calendar.
    const threatened = windows.find(
      (w) =>
        w.questId === quest.id &&
        w.status === 'accepted' &&
        w.ownerId === viewerId &&
        new Date(w.start).getTime() - now.getTime() < 36 * 3600_000 &&
        new Date(w.start).getTime() > now.getTime() &&
        (capacities[w.ownerId]?.band ?? 'steady') === 'depleted',
    );
    if (threatened) {
      nudges.push({
        id: `n_protect_${threatened.id}`,
        kind: 'protect-time',
        aboutUserId: quest.ownerId,
        toUserId: viewerId,
        questId: quest.id,
        title: 'Your block is at risk',
        message: `Capacity dropped since SideQuest booked this. Move it rather than white-knuckle it — a moved session keeps the streak, a skipped one does not.`,
        reasons: [
          `Capacity fell to ${capacities[threatened.ownerId]?.score ?? 0}/100.`,
          `Block is ${threatened.minutes}m on ${threatened.date}.`,
        ],
        createdAt: iso(now),
        status: 'open',
      });
    }

    // 4. Slipping but not gone — the cheapest possible restart.
    if (streak.health === 'slipping' && quest.ownerId === viewerId) {
      nudges.push({
        id: `n_restart_${quest.id}`,
        kind: 'restart',
        aboutUserId: quest.ownerId,
        toUserId: viewerId,
        questId: quest.id,
        title: 'Restart small',
        message: `Your streak is ${streak.weeks} ${streak.weeks === 1 ? 'week' : 'weeks'} and wobbling. SideQuest will take a 25-minute session this week over nothing — that is enough to keep it alive.`,
        reasons: [
          `${streak.minutesThisWeek}m this week vs ${streak.minutesLastWeek}m last week.`,
          streak.quietDays !== null ? `${streak.quietDays} days since last session.` : 'No recent session.',
        ],
        createdAt: iso(now),
        status: 'open',
      });
    }
  }

  const order: Record<Nudge['kind'], number> = {
    'check-in': 0,
    'protect-time': 1,
    restart: 2,
    rest: 3,
  };
  return nudges.sort((a, b) => order[a.kind] - order[b.kind]);
}

export const NUDGE_COPY: Record<Nudge['kind'], { label: string; tone: string; action: string }> = {
  'check-in': { label: 'Check in', tone: 'primary', action: 'Send a message' },
  'protect-time': { label: 'Protect time', tone: 'warning', action: 'Move the block' },
  rest: { label: 'Ease off', tone: 'success', action: 'Hold the next block' },
  restart: { label: 'Restart', tone: 'secondary', action: 'Take a 25m session' },
};
