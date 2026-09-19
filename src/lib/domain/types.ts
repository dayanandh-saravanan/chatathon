/**
 * SideQuest domain model.
 *
 * SideQuest is an agentic hobby network for teams. It protects the part of a
 * person's life that work quietly eats: the thing they were learning before
 * the calendar filled up.
 *
 * Every type here is serialisable — the whole graph crosses the server/client
 * boundary as plain JSON.
 */

export type UserId = string;
/** `yyyy-MM-dd`, always in the member's local timezone. */
export type DateKey = string;
/** Full ISO-8601 instant. */
export type Instant = string;

export type QuestCategory =
  | 'music'
  | 'fitness'
  | 'craft'
  | 'outdoors'
  | 'cooking'
  | 'learning'
  | 'art'
  | 'other';

export interface TeamMember {
  id: UserId;
  name: string;
  handle: string;
  role: string;
  initials: string;
  /** HSL triplet used for the member's accent colour, e.g. `262 52% 62%`. */
  accent: string;
  timezone: string;
  joinedAt: Instant;
  /** Profile photo under /people. Falls back to initials when absent. */
  photoUrl?: string;
}

export interface Milestone {
  id: string;
  questId: string;
  order: number;
  title: string;
  detail: string;
  /** How many quest sessions this milestone is expected to take. */
  estimatedSessions: number;
  sessionsDone: number;
  status: 'locked' | 'current' | 'done';
  completedAt?: Instant;
}

export interface Quest {
  id: string;
  ownerId: UserId;
  title: string;
  category: QuestCategory;
  /** The member's own words for why this matters — never AI-rewritten. */
  why: string;
  targetDate: DateKey;
  /** What the member *said* they want. The agent treats it as a ceiling, not a quota. */
  weeklyMinutesTarget: number;
  /** Preferred single-session length in minutes. */
  sessionMinutes: number;
  status: 'active' | 'paused' | 'done';
  createdAt: Instant;
  milestones: Milestone[];
}

export type EventKind = 'meeting' | 'focus' | 'commute' | 'personal' | 'quest';

export interface CalendarEvent {
  id: string;
  ownerId: UserId;
  title: string;
  kind: EventKind;
  start: Instant;
  end: Instant;
  attendees?: number;
}

/**
 * One day of wearable telemetry. Shaped after the WHOOP daily cycle so a real
 * WHOOP account can be dropped in behind {@link SignalSource} without the
 * capacity engine changing.
 */
export interface DailySignal {
  ownerId: UserId;
  date: DateKey;
  /** WHOOP recovery percentage, 0–100. */
  recovery: number;
  sleepHours: number;
  /** Minutes of sleep owed against the member's own need. */
  sleepDebtMinutes: number;
  /** WHOOP day strain, 0–21. */
  dayStrain: number;
  restingHr: number;
  hrvMs: number;
  source: 'whoop' | 'whoop-sim';
}

export type CapacityBand = 'depleted' | 'steady' | 'primed';

export interface CapacityFactor {
  key: 'recovery' | 'sleep' | 'meetings' | 'strain';
  label: string;
  /** Normalised 0–1 health of this factor (1 = great). */
  normalised: number;
  /** Points this factor contributed to the 0–100 score. */
  points: number;
  /** Maximum points this factor can contribute. */
  maxPoints: number;
  detail: string;
}

export interface DayCapacity {
  ownerId: UserId;
  date: DateKey;
  /** 0–100. The single number the scheduler trusts. */
  score: number;
  band: CapacityBand;
  meetingMinutes: number;
  /** Longest unbroken stretch of meetings, in minutes. */
  longestMeetingRun: number;
  backToBackCount: number;
  /** Minutes of hobby time the agent is willing to place on this day. */
  dailyBudgetMinutes: number;
  factors: CapacityFactor[];
  /** One plain sentence a human can read out loud. */
  headline: string;
}

export type WindowStatus =
  | 'proposed'
  | 'accepted'
  | 'declined'
  | 'completed'
  | 'missed';

/**
 * A concrete block of time the agent wants to hand back to a member.
 * `rationale` and `risks` are the audit trail — the demo shows the signal,
 * the decision and the action, so the reasoning is first-class data.
 */
export interface QuestWindow {
  id: string;
  ownerId: UserId;
  questId: string;
  milestoneId?: string;
  date: DateKey;
  start: Instant;
  end: Instant;
  minutes: number;
  /** 0–100 fit score; higher means the agent is more confident. */
  score: number;
  rationale: string[];
  risks: string[];
  status: WindowStatus;
  createdAt: Instant;
}

export interface Cheer {
  userId: UserId;
  emoji: string;
}

export type PostKind = 'progress' | 'milestone' | 'rest' | 'restart';

export interface Post {
  id: string;
  authorId: UserId;
  questId: string;
  kind: PostKind;
  body: string;
  /** Real photo for the post. The feed is photo-first; this is the content. */
  photoUrl?: string;
  /** Fallback tile when there is no photo yet. */
  glyph: string;
  minutes?: number;
  milestoneTitle?: string;
  createdAt: Instant;
  cheers: Cheer[];
}

export type NudgeKind = 'check-in' | 'protect-time' | 'rest' | 'restart';

/**
 * A private prompt to one human about another. SideQuest never posts these
 * publicly and never ranks people — the team explicitly rejected leaderboards
 * because falling behind in public is demotivating.
 */
export interface Nudge {
  id: string;
  kind: NudgeKind;
  /** Who the nudge is about. */
  aboutUserId: UserId;
  /** Who is being asked to act. */
  toUserId: UserId;
  questId?: string;
  title: string;
  message: string;
  /** The observable signals that triggered this nudge. */
  reasons: string[];
  createdAt: Instant;
  status: 'open' | 'acted' | 'dismissed';
}

export interface QuestStreak {
  questId: string;
  /** Consecutive weeks containing at least one completed session. */
  weeks: number;
  /** Days since the last completed session, or null if there has never been one. */
  quietDays: number | null;
  minutesThisWeek: number;
  minutesLastWeek: number;
  sessionsThisWeek: number;
  /** `weeklyMinutesTarget` adherence as a 0–1 ratio, capped at 1.5. */
  adherence: number;
  health: 'thriving' | 'steady' | 'slipping' | 'quiet';
}

export interface TeamPulse {
  weekStart: DateKey;
  /** Minutes of hobby time the team actually completed this week. */
  minutesReclaimed: number;
  minutesLastWeek: number;
  /** Members with at least one completed session this week. */
  participating: number;
  memberCount: number;
  questsThriving: number;
  questsQuiet: number;
  averageCapacity: number;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  createdAt: Instant;
  /** Structured side-effects the agent produced alongside its reply. */
  actions?: AgentAction[];
}

export type AgentAction =
  | { type: 'quest-drafted'; quest: Quest }
  | { type: 'windows-proposed'; windows: QuestWindow[] }
  | { type: 'nudge-drafted'; nudge: Nudge }
  | { type: 'none' };

/** Everything one page needs about the signed-in member. */
export interface MemberSnapshot {
  member: TeamMember;
  today: DayCapacity;
  week: DayCapacity[];
  quests: Quest[];
  streaks: Record<string, QuestStreak>;
  windows: QuestWindow[];
  events: CalendarEvent[];
  signals: DailySignal[];
}
