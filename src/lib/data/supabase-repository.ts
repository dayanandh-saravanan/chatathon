import type {
  AgentAction,
  AgentMessage,
  CalendarEvent,
  Cheer,
  DailySignal,
  Milestone,
  Post,
  Quest,
  QuestWindow,
  TeamMember,
  UserId,
} from '@/lib/domain/types';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Repository, SeedBundle } from './repository';

/**
 * Postgres-backed store.
 *
 * Column names intentionally drift from the domain types — `starts_at`/`ends_at`
 * instead of `start`/`end`, `day` instead of `date`, `position` instead of
 * `order` — because those TS names are reserved-ish or ambiguous in SQL. The
 * `rowTo*` functions below are the only place that drift is allowed to exist.
 */

// ------------------------------------------------------------------ row shapes

interface MemberRow {
  id: string;
  name: string;
  handle: string;
  role: string;
  initials: string;
  accent: string;
  timezone: string;
  joined_at: string;
}

interface MilestoneRow {
  id: string;
  quest_id: string;
  position: number;
  title: string;
  detail: string;
  estimated_sessions: number;
  sessions_done: number;
  status: Milestone['status'];
  completed_at: string | null;
}

interface QuestRow {
  id: string;
  owner_id: string;
  title: string;
  category: Quest['category'];
  why: string;
  target_date: string;
  weekly_minutes_target: number;
  session_minutes: number;
  status: Quest['status'];
  created_at: string;
  sq_milestones?: MilestoneRow[];
}

interface EventRow {
  id: string;
  owner_id: string;
  title: string;
  kind: CalendarEvent['kind'];
  starts_at: string;
  ends_at: string;
  attendees: number | null;
}

interface SignalRow {
  owner_id: string;
  day: string;
  recovery: number;
  sleep_hours: number | string;
  sleep_debt_minutes: number;
  day_strain: number | string;
  resting_hr: number;
  hrv_ms: number;
  source: string;
}

interface WindowRow {
  id: string;
  owner_id: string;
  quest_id: string;
  milestone_id: string | null;
  day: string;
  starts_at: string;
  ends_at: string;
  minutes: number;
  score: number;
  rationale: string[];
  risks: string[];
  status: QuestWindow['status'];
  created_at: string;
}

interface CheerRow {
  post_id: string;
  user_id: string;
  emoji: string;
}

interface PostRow {
  id: string;
  author_id: string;
  quest_id: string;
  kind: Post['kind'];
  body: string;
  glyph: string;
  minutes: number | null;
  milestone_title: string | null;
  created_at: string;
  sq_cheers?: Array<Pick<CheerRow, 'user_id' | 'emoji'>>;
}

interface MessageRow {
  id: string;
  user_id: string;
  role: AgentMessage['role'];
  content: string;
  actions: AgentAction[] | null;
  created_at: string;
}

// ------------------------------------------------------------------ row → domain

/** Postgres hands back `+00:00`; the rest of the app compares `Z` strings. */
function instant(value: string): string {
  return new Date(value).toISOString();
}

function rowToMember(row: MemberRow): TeamMember {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    role: row.role,
    initials: row.initials,
    accent: row.accent,
    timezone: row.timezone,
    joinedAt: instant(row.joined_at),
  };
}

function rowToMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    questId: row.quest_id,
    order: row.position,
    title: row.title,
    detail: row.detail,
    estimatedSessions: row.estimated_sessions,
    sessionsDone: row.sessions_done,
    status: row.status,
    completedAt: row.completed_at ? instant(row.completed_at) : undefined,
  };
}

function rowToQuest(row: QuestRow): Quest {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    category: row.category,
    why: row.why,
    targetDate: row.target_date,
    weeklyMinutesTarget: row.weekly_minutes_target,
    sessionMinutes: row.session_minutes,
    status: row.status,
    createdAt: instant(row.created_at),
    // Sorted here rather than in the query so the ladder order survives any
    // PostgREST embedding quirk.
    milestones: [...(row.sq_milestones ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(rowToMilestone),
  };
}

function rowToEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    kind: row.kind,
    start: instant(row.starts_at),
    end: instant(row.ends_at),
    attendees: row.attendees ?? undefined,
  };
}

function rowToSignal(row: SignalRow): DailySignal {
  return {
    ownerId: row.owner_id,
    date: row.day,
    recovery: row.recovery,
    // `numeric` can arrive as a string depending on the PostgREST version.
    sleepHours: Number(row.sleep_hours),
    sleepDebtMinutes: row.sleep_debt_minutes,
    dayStrain: Number(row.day_strain),
    restingHr: row.resting_hr,
    hrvMs: row.hrv_ms,
    source: row.source === 'whoop' ? 'whoop' : 'whoop-sim',
  };
}

function rowToWindow(row: WindowRow): QuestWindow {
  return {
    id: row.id,
    ownerId: row.owner_id,
    questId: row.quest_id,
    milestoneId: row.milestone_id ?? undefined,
    date: row.day,
    start: instant(row.starts_at),
    end: instant(row.ends_at),
    minutes: row.minutes,
    score: row.score,
    rationale: row.rationale ?? [],
    risks: row.risks ?? [],
    status: row.status,
    createdAt: instant(row.created_at),
  };
}

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    authorId: row.author_id,
    questId: row.quest_id,
    kind: row.kind,
    body: row.body,
    glyph: row.glyph,
    minutes: row.minutes ?? undefined,
    milestoneTitle: row.milestone_title ?? undefined,
    createdAt: instant(row.created_at),
    cheers: (row.sq_cheers ?? []).map(
      (c): Cheer => ({ userId: c.user_id, emoji: c.emoji }),
    ),
  };
}

function rowToMessage(row: MessageRow): AgentMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: instant(row.created_at),
    actions: row.actions ?? undefined,
  };
}

// ------------------------------------------------------------------ domain → row

function memberToRow(m: TeamMember): MemberRow {
  return {
    id: m.id,
    name: m.name,
    handle: m.handle,
    role: m.role,
    initials: m.initials,
    accent: m.accent,
    timezone: m.timezone,
    joined_at: m.joinedAt,
  };
}

function questToRow(q: Quest): Omit<QuestRow, 'sq_milestones'> {
  return {
    id: q.id,
    owner_id: q.ownerId,
    title: q.title,
    category: q.category,
    why: q.why,
    target_date: q.targetDate,
    weekly_minutes_target: q.weeklyMinutesTarget,
    session_minutes: q.sessionMinutes,
    status: q.status,
    created_at: q.createdAt,
  };
}

function milestoneToRow(m: Milestone): MilestoneRow {
  return {
    id: m.id,
    quest_id: m.questId,
    position: m.order,
    title: m.title,
    detail: m.detail,
    estimated_sessions: m.estimatedSessions,
    sessions_done: m.sessionsDone,
    status: m.status,
    completed_at: m.completedAt ?? null,
  };
}

function eventToRow(e: CalendarEvent): EventRow {
  return {
    id: e.id,
    owner_id: e.ownerId,
    title: e.title,
    kind: e.kind,
    starts_at: e.start,
    ends_at: e.end,
    attendees: e.attendees ?? null,
  };
}

function signalToRow(s: DailySignal): SignalRow {
  return {
    owner_id: s.ownerId,
    day: s.date,
    recovery: s.recovery,
    sleep_hours: s.sleepHours,
    sleep_debt_minutes: s.sleepDebtMinutes,
    day_strain: s.dayStrain,
    resting_hr: s.restingHr,
    hrv_ms: s.hrvMs,
    source: s.source,
  };
}

function windowToRow(w: QuestWindow): WindowRow {
  return {
    id: w.id,
    owner_id: w.ownerId,
    quest_id: w.questId,
    milestone_id: w.milestoneId ?? null,
    day: w.date,
    starts_at: w.start,
    ends_at: w.end,
    minutes: w.minutes,
    score: w.score,
    rationale: w.rationale,
    risks: w.risks,
    status: w.status,
    created_at: w.createdAt,
  };
}

function postToRow(p: Post): Omit<PostRow, 'sq_cheers'> {
  return {
    id: p.id,
    author_id: p.authorId,
    quest_id: p.questId,
    kind: p.kind,
    body: p.body,
    glyph: p.glyph,
    minutes: p.minutes ?? null,
    milestone_title: p.milestoneTitle ?? null,
    created_at: p.createdAt,
  };
}

// ------------------------------------------------------------------ repository

/** Tables in the order a delete must walk them: children before parents. */
const WIPE_ORDER: Array<[table: string, notNullColumn: string]> = [
  ['sq_cheers', 'post_id'],
  ['sq_posts', 'id'],
  ['sq_nudge_dismissals', 'nudge_id'],
  ['sq_agent_messages', 'id'],
  ['sq_quest_windows', 'id'],
  ['sq_milestones', 'id'],
  ['sq_quests', 'id'],
  ['sq_calendar_events', 'id'],
  ['sq_daily_signals', 'owner_id'],
  ['sq_members', 'id'],
];

/** PostgREST rejects very large bodies; the seed is a few thousand rows. */
const CHUNK = 500;

function chunk<T>(rows: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;

  private get db() {
    return supabaseAdmin();
  }

  /**
   * Cheapest possible reachability probe. `getRepository()` calls this before
   * committing to Supabase and falls back to memory when it throws, so a dead
   * network never takes the demo down.
   */
  async healthCheck(): Promise<void> {
    const { error } = await this.db.from('sq_members').select('id').limit(1);
    if (error) throw new Error(`Supabase health check failed: ${error.message}`);
  }

  // ---------------------------------------------------------------- reads

  async listMembers(): Promise<TeamMember[]> {
    const { data, error } = await this.db.from('sq_members').select('*').order('joined_at');
    if (error) throw new Error(`listMembers: ${error.message}`);
    return (data as MemberRow[]).map(rowToMember);
  }

  async listQuests(): Promise<Quest[]> {
    const { data, error } = await this.db
      .from('sq_quests')
      .select('*, sq_milestones(*)')
      .order('created_at');
    if (error) throw new Error(`listQuests: ${error.message}`);
    return (data as QuestRow[]).map(rowToQuest);
  }

  async listEvents(): Promise<CalendarEvent[]> {
    const { data, error } = await this.db
      .from('sq_calendar_events')
      .select('*')
      .order('starts_at');
    if (error) throw new Error(`listEvents: ${error.message}`);
    return (data as EventRow[]).map(rowToEvent);
  }

  async listSignals(): Promise<DailySignal[]> {
    const { data, error } = await this.db.from('sq_daily_signals').select('*').order('day');
    if (error) throw new Error(`listSignals: ${error.message}`);
    return (data as SignalRow[]).map(rowToSignal);
  }

  async listWindows(): Promise<QuestWindow[]> {
    const { data, error } = await this.db
      .from('sq_quest_windows')
      .select('*')
      .order('starts_at');
    if (error) throw new Error(`listWindows: ${error.message}`);
    return (data as WindowRow[]).map(rowToWindow);
  }

  async listPosts(): Promise<Post[]> {
    const { data, error } = await this.db
      .from('sq_posts')
      .select('*, sq_cheers(user_id, emoji)')
      .order('created_at', { ascending: false });
    if (error) throw new Error(`listPosts: ${error.message}`);
    return (data as PostRow[]).map(rowToPost);
  }

  async listDismissedNudgeIds(userId: UserId): Promise<string[]> {
    const { data, error } = await this.db
      .from('sq_nudge_dismissals')
      .select('nudge_id')
      .eq('user_id', userId);
    if (error) throw new Error(`listDismissedNudgeIds: ${error.message}`);
    return (data as Array<{ nudge_id: string }>).map((r) => r.nudge_id);
  }

  async listMessages(userId: UserId): Promise<AgentMessage[]> {
    const { data, error } = await this.db
      .from('sq_agent_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');
    if (error) throw new Error(`listMessages: ${error.message}`);
    return (data as MessageRow[]).map(rowToMessage);
  }

  // ---------------------------------------------------------------- writes

  async insertQuest(quest: Quest): Promise<Quest> {
    const { error } = await this.db.from('sq_quests').insert(questToRow(quest));
    if (error) throw new Error(`insertQuest: ${error.message}`);

    if (quest.milestones.length > 0) {
      const { error: mError } = await this.db
        .from('sq_milestones')
        .insert(quest.milestones.map(milestoneToRow));
      if (mError) throw new Error(`insertQuest milestones: ${mError.message}`);
    }
    return quest;
  }

  async upsertWindows(windows: QuestWindow[]): Promise<void> {
    if (windows.length === 0) return;
    const { error } = await this.db
      .from('sq_quest_windows')
      .upsert(windows.map(windowToRow), { onConflict: 'id' });
    if (error) throw new Error(`upsertWindows: ${error.message}`);
  }

  async deleteProposals(questId: string): Promise<void> {
    const { error } = await this.db
      .from('sq_quest_windows')
      .delete()
      .eq('quest_id', questId)
      .eq('status', 'proposed');
    if (error) throw new Error(`deleteProposals: ${error.message}`);
  }

  async updateWindowStatus(
    windowId: string,
    status: QuestWindow['status'],
  ): Promise<QuestWindow | null> {
    const { data, error } = await this.db
      .from('sq_quest_windows')
      .update({ status })
      .eq('id', windowId)
      .select('*')
      .maybeSingle();
    if (error) throw new Error(`updateWindowStatus: ${error.message}`);
    return data ? rowToWindow(data as WindowRow) : null;
  }

  async updateMilestone(
    milestoneId: string,
    patch: {
      sessionsDone?: number;
      status?: Milestone['status'];
      completedAt?: string | null;
    },
  ): Promise<void> {
    const update: Partial<MilestoneRow> = {};
    if (patch.sessionsDone !== undefined) update.sessions_done = patch.sessionsDone;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;
    if (Object.keys(update).length === 0) return;

    const { error } = await this.db.from('sq_milestones').update(update).eq('id', milestoneId);
    if (error) throw new Error(`updateMilestone: ${error.message}`);
  }

  async updateQuestStatus(questId: string, status: Quest['status']): Promise<void> {
    const { error } = await this.db.from('sq_quests').update({ status }).eq('id', questId);
    if (error) throw new Error(`updateQuestStatus: ${error.message}`);
  }

  async insertPost(post: Post): Promise<Post> {
    const { error } = await this.db.from('sq_posts').insert(postToRow(post));
    if (error) throw new Error(`insertPost: ${error.message}`);

    if (post.cheers.length > 0) {
      const { error: cError } = await this.db.from('sq_cheers').upsert(
        post.cheers.map((c) => ({ post_id: post.id, user_id: c.userId, emoji: c.emoji })),
        { onConflict: 'post_id,user_id' },
      );
      if (cError) throw new Error(`insertPost cheers: ${cError.message}`);
    }
    return post;
  }

  async setCheer(postId: string, userId: UserId, emoji: string | null): Promise<void> {
    if (emoji === null) {
      const { error } = await this.db
        .from('sq_cheers')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);
      if (error) throw new Error(`setCheer clear: ${error.message}`);
      return;
    }

    const { error } = await this.db
      .from('sq_cheers')
      .upsert({ post_id: postId, user_id: userId, emoji }, { onConflict: 'post_id,user_id' });
    if (error) throw new Error(`setCheer: ${error.message}`);
  }

  async dismissNudge(nudgeId: string, userId: UserId): Promise<void> {
    // Nudges are derived from live signals, so only the dismissal persists.
    const { error } = await this.db
      .from('sq_nudge_dismissals')
      .upsert(
        { nudge_id: nudgeId, user_id: userId },
        { onConflict: 'nudge_id,user_id', ignoreDuplicates: true },
      );
    if (error) throw new Error(`dismissNudge: ${error.message}`);
  }

  async insertMessage(message: AgentMessage, userId: UserId): Promise<AgentMessage> {
    const { error } = await this.db.from('sq_agent_messages').insert({
      id: message.id,
      user_id: userId,
      role: message.role,
      content: message.content,
      actions: message.actions ?? [],
      created_at: message.createdAt,
    });
    if (error) throw new Error(`insertMessage: ${error.message}`);
    return message;
  }

  // ---------------------------------------------------------------- lifecycle

  async reseed(data: SeedBundle): Promise<void> {
    for (const [table, column] of WIPE_ORDER) {
      // PostgREST refuses an unfiltered delete; a not-null test on a NOT NULL
      // column is the standard "match every row" spelling.
      const { error } = await this.db.from(table).delete().not(column, 'is', null);
      if (error) throw new Error(`reseed wipe ${table}: ${error.message}`);
    }

    const milestones = data.quests.flatMap((q) => q.milestones.map(milestoneToRow));
    const cheers = data.posts.flatMap((p) =>
      p.cheers.map((c) => ({ post_id: p.id, user_id: c.userId, emoji: c.emoji })),
    );

    const inserts: Array<[table: string, rows: object[]]> = [
      ['sq_members', data.members.map(memberToRow)],
      ['sq_quests', data.quests.map(questToRow)],
      ['sq_milestones', milestones],
      ['sq_calendar_events', data.events.map(eventToRow)],
      ['sq_daily_signals', data.signals.map(signalToRow)],
      ['sq_quest_windows', data.windows.map(windowToRow)],
      ['sq_posts', data.posts.map(postToRow)],
      ['sq_cheers', cheers],
    ];

    for (const [table, rows] of inserts) {
      for (const batch of chunk(rows)) {
        const { error } = await this.db.from(table).insert(batch);
        if (error) throw new Error(`reseed insert ${table}: ${error.message}`);
      }
    }
  }

  async isSeeded(): Promise<boolean> {
    const { count, error } = await this.db
      .from('sq_members')
      .select('id', { count: 'exact', head: true });
    if (error) throw new Error(`isSeeded: ${error.message}`);
    return (count ?? 0) > 0;
  }
}
