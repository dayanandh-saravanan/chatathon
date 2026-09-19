import 'server-only';

import type {
  AgentMessage,
  CalendarEvent,
  DailySignal,
  DateKey,
  DayCapacity,
  MemberSnapshot,
  Nudge,
  Post,
  Quest,
  QuestStreak,
  QuestWindow,
  TeamMember,
  TeamPulse,
  UserId,
} from '@/lib/domain/types';
import { computeCapacity } from '@/lib/domain/capacity';
import { computeStreak, computeTeamPulse } from '@/lib/domain/streaks';
import { generateNudges } from '@/lib/domain/nudges';
import { addDays, dateKey, startOfWeek } from '@/lib/domain/time';
import { getRepository } from './index';
import {
  FUTURE_DAYS,
  TEAM,
  VIEWER_ID,
  buildCalendar,
  buildPosts,
  buildQuests,
  buildSignals,
  buildWindowHistory,
} from './seed';

/**
 * Read/derive layer. Pages and route handlers talk to this and nothing else.
 * Everything here is async because the repository may be a network away.
 */

export { VIEWER_ID };

/** Seeds the store on first use so a cold clone or empty database just works. */
export async function ensureSeeded(): Promise<void> {
  const repo = await getRepository();
  if (await repo.isSeeded()) return;
  await repo.reseed(buildSeedBundle());
}

export function buildSeedBundle() {
  const now = new Date();
  const quests = buildQuests(now);
  return {
    members: TEAM,
    quests,
    events: buildCalendar(now),
    signals: buildSignals(now),
    windows: buildWindowHistory(now, quests),
    posts: buildPosts(now, quests),
  };
}

interface World {
  members: TeamMember[];
  quests: Quest[];
  events: CalendarEvent[];
  signals: DailySignal[];
  windows: QuestWindow[];
  posts: Post[];
}

/** One round-trip per request; every derived value is computed from this. */
async function world(): Promise<World> {
  await ensureSeeded();
  const repo = await getRepository();
  const [members, quests, events, signals, windows, posts] = await Promise.all([
    repo.listMembers(),
    repo.listQuests(),
    repo.listEvents(),
    repo.listSignals(),
    repo.listWindows(),
    repo.listPosts(),
  ]);
  return { members, quests, events, signals, windows, posts };
}

/**
 * Accepted and completed quest blocks are real load. If the scheduler cannot
 * see them it will cheerfully book a second session on top of the first.
 */
function questBlocksAsEvents(windows: QuestWindow[], ownerId: UserId): CalendarEvent[] {
  return windows
    .filter((w) => w.ownerId === ownerId && (w.status === 'accepted' || w.status === 'completed'))
    .map((w) => ({
      id: `qe_${w.id}`,
      ownerId,
      title: 'SideQuest block',
      kind: 'quest' as const,
      start: w.start,
      end: w.end,
    }));
}

function capacityFrom(w: World, ownerId: UserId, day: DateKey): DayCapacity {
  const dayEvents = [
    ...w.events.filter((e) => e.ownerId === ownerId && e.start.slice(0, 10) === day),
    ...questBlocksAsEvents(w.windows, ownerId).filter((e) => e.start.slice(0, 10) === day),
  ];
  const signal = w.signals.find((s) => s.ownerId === ownerId && s.date === day);
  return computeCapacity(ownerId, day, signal, dayEvents);
}

export async function getMembers(): Promise<TeamMember[]> {
  return (await world()).members;
}

export async function getViewer(): Promise<TeamMember> {
  const members = await getMembers();
  const m = members.find((x) => x.id === VIEWER_ID);
  if (!m) throw new Error('Viewer missing from dataset');
  return m;
}

export async function getSnapshot(ownerId: UserId = VIEWER_ID): Promise<MemberSnapshot> {
  const w = await world();
  const member = w.members.find((m) => m.id === ownerId);
  if (!member) throw new Error(`Unknown member ${ownerId}`);

  const now = new Date();
  const weekStart = startOfWeek(now);
  const from = dateKey(weekStart);
  const to = dateKey(addDays(weekStart, 6));

  const windows = w.windows
    .filter((x) => x.ownerId === ownerId)
    .sort((a, b) => a.start.localeCompare(b.start));
  const quests = w.quests.filter((q) => q.ownerId === ownerId);

  return {
    member,
    today: capacityFrom(w, ownerId, dateKey(now)),
    week: Array.from({ length: 7 }, (_, i) =>
      capacityFrom(w, ownerId, dateKey(addDays(weekStart, i))),
    ),
    quests,
    streaks: Object.fromEntries(quests.map((q) => [q.id, computeStreak(q, windows, now)])),
    windows,
    events: w.events
      .filter((e) => e.ownerId === ownerId)
      .filter((e) => {
        const k = e.start.slice(0, 10);
        return k >= from && k <= to;
      })
      .sort((a, b) => a.start.localeCompare(b.start)),
    signals: w.signals.filter((s) => s.ownerId === ownerId && s.date >= from && s.date <= to),
  };
}

/** Days the scheduler is allowed to place blocks in, starting today. */
export async function getPlanningHorizon(ownerId: UserId): Promise<DayCapacity[]> {
  const w = await world();
  const now = new Date();
  return Array.from({ length: FUTURE_DAYS }, (_, i) =>
    capacityFrom(w, ownerId, dateKey(addDays(now, i))),
  );
}

export async function getPlanningEvents(ownerId: UserId): Promise<CalendarEvent[]> {
  const w = await world();
  return [
    ...w.events.filter((e) => e.ownerId === ownerId),
    ...questBlocksAsEvents(w.windows, ownerId),
  ];
}

export async function getAllStreaks(): Promise<Record<string, QuestStreak>> {
  const w = await world();
  const now = new Date();
  return Object.fromEntries(w.quests.map((q) => [q.id, computeStreak(q, w.windows, now)]));
}

export async function getTeamPulse(): Promise<TeamPulse> {
  const w = await world();
  const now = new Date();
  const today = dateKey(now);
  const capacities = w.members.map((m) => capacityFrom(w, m.id, today));
  return computeTeamPulse(w.members, w.quests, w.windows, capacities, now);
}

export interface TeamMemberCard {
  member: TeamMember;
  quest?: Quest;
  streak?: QuestStreak;
  capacity: DayCapacity;
}

export async function getTeamCards(): Promise<TeamMemberCard[]> {
  const w = await world();
  const now = new Date();
  const today = dateKey(now);
  return w.members.map((member) => {
    const quest = w.quests.find((q) => q.ownerId === member.id && q.status === 'active');
    return {
      member,
      quest,
      streak: quest ? computeStreak(quest, w.windows, now) : undefined,
      capacity: capacityFrom(w, member.id, today),
    };
  });
}

export async function getNudges(viewerId: UserId = VIEWER_ID): Promise<Nudge[]> {
  const w = await world();
  const repo = await getRepository();
  const now = new Date();
  const today = dateKey(now);

  const capacities = Object.fromEntries(
    w.members.map((m) => [m.id, capacityFrom(w, m.id, today)]),
  );
  const streaks = Object.fromEntries(
    w.quests.map((q) => [q.id, computeStreak(q, w.windows, now)]),
  );
  const dismissed = new Set(await repo.listDismissedNudgeIds(viewerId));

  return generateNudges({
    members: w.members,
    quests: w.quests,
    streaks,
    windows: w.windows,
    posts: w.posts,
    capacities,
    viewerId,
    now,
  }).filter((n) => !dismissed.has(n.id));
}

export interface FeedEntry {
  post: Post;
  author: TeamMember;
  quest?: Quest;
}

export async function getFeed(): Promise<FeedEntry[]> {
  const w = await world();
  return [...w.posts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((post) => ({
      post,
      author: w.members.find((m) => m.id === post.authorId)!,
      quest: w.quests.find((q) => q.id === post.questId),
    }))
    .filter((e) => Boolean(e.author));
}

export async function getQuest(questId: string): Promise<Quest | undefined> {
  return (await world()).quests.find((q) => q.id === questId);
}

export async function getConversation(userId: UserId = VIEWER_ID): Promise<AgentMessage[]> {
  await ensureSeeded();
  const repo = await getRepository();
  return repo.listMessages(userId);
}
