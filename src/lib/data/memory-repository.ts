import type {
  AgentMessage,
  CalendarEvent,
  DailySignal,
  Post,
  Quest,
  QuestWindow,
  TeamMember,
  UserId,
} from '@/lib/domain/types';
import type { Repository, SeedBundle } from './repository';

/**
 * Zero-dependency store. The app is fully functional on this — clone the repo,
 * `npm run dev`, and everything works without a single environment variable.
 * State lives on `globalThis` so Next.js hot reloads do not wipe the demo.
 */
interface MemoryState extends SeedBundle {
  dismissals: Map<UserId, Set<string>>;
  messages: Map<UserId, AgentMessage[]>;
}

declare global {
  var __sidequestMemory: MemoryState | undefined;
}

function state(): MemoryState {
  if (!globalThis.__sidequestMemory) {
    globalThis.__sidequestMemory = {
      members: [],
      quests: [],
      events: [],
      signals: [],
      windows: [],
      posts: [],
      dismissals: new Map(),
      messages: new Map(),
    };
  }
  return globalThis.__sidequestMemory;
}

export class MemoryRepository implements Repository {
  readonly kind = 'memory' as const;

  async listMembers(): Promise<TeamMember[]> {
    return state().members;
  }
  async listQuests(): Promise<Quest[]> {
    return state().quests;
  }
  async listEvents(): Promise<CalendarEvent[]> {
    return state().events;
  }
  async listSignals(): Promise<DailySignal[]> {
    return state().signals;
  }
  async listWindows(): Promise<QuestWindow[]> {
    return state().windows;
  }
  async listPosts(): Promise<Post[]> {
    return state().posts;
  }
  async listDismissedNudgeIds(userId: UserId): Promise<string[]> {
    return [...(state().dismissals.get(userId) ?? [])];
  }
  async listMessages(userId: UserId): Promise<AgentMessage[]> {
    return state().messages.get(userId) ?? [];
  }

  async insertQuest(quest: Quest): Promise<Quest> {
    state().quests.push(quest);
    return quest;
  }

  async upsertWindows(windows: QuestWindow[]): Promise<void> {
    const s = state();
    for (const w of windows) {
      const i = s.windows.findIndex((x) => x.id === w.id);
      if (i >= 0) s.windows[i] = w;
      else s.windows.push(w);
    }
  }

  async deleteProposals(questId: string): Promise<void> {
    const s = state();
    s.windows = s.windows.filter((w) => !(w.questId === questId && w.status === 'proposed'));
  }

  async updateWindowStatus(
    windowId: string,
    status: QuestWindow['status'],
  ): Promise<QuestWindow | null> {
    const w = state().windows.find((x) => x.id === windowId);
    if (!w) return null;
    w.status = status;
    return w;
  }

  async updateMilestone(
    milestoneId: string,
    patch: { sessionsDone?: number; status?: 'locked' | 'current' | 'done'; completedAt?: string | null },
  ): Promise<void> {
    for (const quest of state().quests) {
      const m = quest.milestones.find((x) => x.id === milestoneId);
      if (!m) continue;
      if (patch.sessionsDone !== undefined) m.sessionsDone = patch.sessionsDone;
      if (patch.status !== undefined) m.status = patch.status;
      if (patch.completedAt !== undefined) m.completedAt = patch.completedAt ?? undefined;
      return;
    }
  }

  async updateQuestStatus(questId: string, status: Quest['status']): Promise<void> {
    const q = state().quests.find((x) => x.id === questId);
    if (q) q.status = status;
  }

  async insertPost(post: Post): Promise<Post> {
    state().posts.unshift(post);
    return post;
  }

  async setCheer(postId: string, userId: UserId, emoji: string | null): Promise<void> {
    const post = state().posts.find((p) => p.id === postId);
    if (!post) return;
    const i = post.cheers.findIndex((c) => c.userId === userId);
    if (emoji === null) {
      if (i >= 0) post.cheers.splice(i, 1);
      return;
    }
    if (i >= 0) post.cheers[i] = { userId, emoji };
    else post.cheers.push({ userId, emoji });
  }

  async dismissNudge(nudgeId: string, userId: UserId): Promise<void> {
    const s = state();
    const set = s.dismissals.get(userId) ?? new Set<string>();
    set.add(nudgeId);
    s.dismissals.set(userId, set);
  }

  async insertMessage(message: AgentMessage, userId: UserId): Promise<AgentMessage> {
    const s = state();
    const list = s.messages.get(userId) ?? [];
    list.push(message);
    s.messages.set(userId, list);
    return message;
  }

  async reseed(data: SeedBundle): Promise<void> {
    globalThis.__sidequestMemory = {
      ...structuredClone(data),
      dismissals: new Map(),
      messages: new Map(),
    };
  }

  async isSeeded(): Promise<boolean> {
    return state().members.length > 0;
  }
}
