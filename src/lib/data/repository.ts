import type {
  AgentMessage,
  CalendarEvent,
  DailySignal,
  DateKey,
  Post,
  Quest,
  QuestWindow,
  TeamMember,
  UserId,
} from '@/lib/domain/types';

/**
 * Persistence boundary.
 *
 * Deliberately dumb: raw entity access only, no domain logic. Capacity,
 * scheduling, streaks and nudges are pure functions computed above this layer,
 * so swapping Postgres for anything else can never change what the product
 * decides — only where the rows live.
 */
export interface Repository {
  readonly kind: 'memory' | 'supabase';

  listMembers(): Promise<TeamMember[]>;
  listQuests(): Promise<Quest[]>;
  listEvents(): Promise<CalendarEvent[]>;
  listSignals(): Promise<DailySignal[]>;
  listWindows(): Promise<QuestWindow[]>;
  listPosts(): Promise<Post[]>;
  listDismissedNudgeIds(userId: UserId): Promise<string[]>;
  listMessages(userId: UserId): Promise<AgentMessage[]>;

  insertQuest(quest: Quest): Promise<Quest>;
  /** Insert or update; proposals churn every time the agent re-plans. */
  upsertWindows(windows: QuestWindow[]): Promise<void>;
  deleteProposals(questId: string): Promise<void>;
  updateWindowStatus(windowId: string, status: QuestWindow['status']): Promise<QuestWindow | null>;
  updateMilestone(
    milestoneId: string,
    patch: { sessionsDone?: number; status?: 'locked' | 'current' | 'done'; completedAt?: string | null },
  ): Promise<void>;
  updateQuestStatus(questId: string, status: Quest['status']): Promise<void>;

  insertPost(post: Post): Promise<Post>;
  setCheer(postId: string, userId: UserId, emoji: string | null): Promise<void>;

  dismissNudge(nudgeId: string, userId: UserId): Promise<void>;
  insertMessage(message: AgentMessage, userId: UserId): Promise<AgentMessage>;

  /** Wipe and reload the demo dataset. */
  reseed(data: SeedBundle): Promise<void>;
  /** True when the store already holds data. */
  isSeeded(): Promise<boolean>;
}

export interface SeedBundle {
  members: TeamMember[];
  quests: Quest[];
  events: CalendarEvent[];
  signals: DailySignal[];
  windows: QuestWindow[];
  posts: Post[];
}

export function eventsOnDay(events: CalendarEvent[], ownerId: UserId, day: DateKey): CalendarEvent[] {
  return events.filter((e) => e.ownerId === ownerId && e.start.slice(0, 10) === day);
}
