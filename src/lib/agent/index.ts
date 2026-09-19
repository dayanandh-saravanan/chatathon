import 'server-only';

import { z } from 'zod';

import type {
  AgentAction,
  AgentMessage,
  DayCapacity,
  MemberSnapshot,
  Nudge,
  Quest,
  QuestWindow,
  UserId,
} from '@/lib/domain/types';
import { BAND_COPY } from '@/lib/domain/capacity';
import { HEALTH_COPY } from '@/lib/domain/streaks';
import { clockTime, dateKey, durationLabel, iso, relativeDay } from '@/lib/domain/time';
import { getRepository } from '@/lib/data';
import {
  getConversation,
  getNudges,
  getPlanningEvents,
  getPlanningHorizon,
  getQuest,
  getSnapshot,
} from '@/lib/data/service';

import { activeProvider, complete, completeJSON, isLLMEnabled } from './provider';
import {
  describePlan,
  fallbackMilestones,
  searchProposals,
  inferCategory,
  inferSessionMinutes,
  inferTargetDate,
  inferWeeklyMinutes,
  titleFromGoal,
  toMilestones,
} from './planner';
import {
  CHAT_SYSTEM,
  QUEST_DRAFT_SYSTEM,
  capacityLine,
  chatUserPrompt,
  questDraftPrompt,
  questLine,
} from './prompts';

export { activeProvider, isLLMEnabled };
export type { ProviderName } from './provider';
export { isVoiceEnabled } from './voice';

/**
 * The agent.
 *
 * Division of labour, strictly: the domain layer decides, this file assembles,
 * and the model — if there is one — rewords. Every number that reaches a member
 * came out of `computeCapacity` or `proposeWindows`. None of them came out of a
 * completion, which is why a missing API key costs nothing but prose.
 */

/* -------------------------------------------------------------------------- */
/* Drafting a quest                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Models add a trailing period and wrap titles in quotes no matter how plainly
 * the prompt forbids both. Cheaper to strip than to re-ask.
 */
function cleanTitle(raw: string): string {
  return raw
    .trim()
    .replace(/^["'\u201c\u2018]+|["'\u201d\u2019]+$/g, '')
    .replace(/[.\s]+$/, '')
    .trim();
}

const QuestDraftSchema = z.object({
  title: z.string().trim().min(3).max(90),
  milestones: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(70),
        detail: z.string().trim().min(3).max(200),
      }),
    )
    .min(1)
    .max(6),
});

export async function draftQuestFromGoal(goalText: string, ownerId: UserId): Promise<Quest> {
  const now = new Date();
  const category = inferCategory(goalText);
  const sessionMinutes = inferSessionMinutes(goalText, category);
  const weeklyMinutesTarget = inferWeeklyMinutes(goalText, category, sessionMinutes);
  // Owner plus creation instant: unique without randomness, which keeps quest
  // ids reproducible if the same request is ever replayed.
  const id = `q_${ownerId.replace(/^u_/, '')}_${now.getTime().toString(36)}`;

  const drafts = fallbackMilestones(goalText, category);
  let title = titleFromGoal(goalText);

  if (isLLMEnabled()) {
    const improved = await completeJSON({
      system: QUEST_DRAFT_SYSTEM,
      user: questDraftPrompt(goalText, category, drafts),
      schema: QuestDraftSchema,
    });
    /**
     * Wording only. Session estimates and the length of the ladder stay ours.
     *
     * The ladder is all-or-nothing: a partial rewrite leaves rung one specific
     * to their words and rung three still reading like a placeholder, which is
     * worse than leaving all four generic. Anything that fails validation is
     * dropped without comment.
     */
    if (improved && improved.milestones.length === drafts.length) {
      const cleaned = cleanTitle(improved.title);
      if (cleaned.length >= 3) title = cleaned;
      improved.milestones.forEach((m, i) => {
        drafts[i] = { ...drafts[i], title: cleanTitle(m.title), detail: m.detail.trim() };
      });
    }
  }

  const quest: Quest = {
    id,
    ownerId,
    title,
    category,
    // Their sentence, kept verbatim. The "why" is the one thing the agent never rewrites.
    why: goalText.trim(),
    targetDate: inferTargetDate(goalText, category, now),
    weeklyMinutesTarget,
    sessionMinutes,
    status: 'active',
    createdAt: iso(now),
    milestones: toMilestones(id, drafts),
  };

  const repo = await getRepository();
  await repo.insertQuest(quest);
  return quest;
}

/* -------------------------------------------------------------------------- */
/* Planning                                                                    */
/* -------------------------------------------------------------------------- */

export async function planQuest(
  questId: string,
  ownerId: UserId,
): Promise<{ windows: QuestWindow[]; note: string; title: string }> {
  const quest = await getQuest(questId);
  if (!quest) throw new Error('That quest does not exist.');

  const now = new Date();
  const todayKey = dateKey(now);
  const [horizon, events, snapshot] = await Promise.all([
    getPlanningHorizon(ownerId),
    getPlanningEvents(ownerId),
    getSnapshot(ownerId),
  ]);

  /**
   * What the scheduler is allowed to treat as already committed. Three
   * deliberate choices:
   *   · every quest of this member, not just this one, so two quests cannot
   *     land on the same evening;
   *   · today forward only, because spent history is not a commitment and
   *     charging it against the weekly ceiling would silently block replanning;
   *   · this quest's own proposals excluded — they are about to be replaced,
   *     and leaving them in would make a re-plan look like a full calendar.
   */
  const committed = snapshot.windows.filter(
    (w) =>
      w.date >= todayKey &&
      (w.status === 'accepted' ||
        w.status === 'completed' ||
        (w.status === 'proposed' && w.questId !== quest.id)),
  );

  const windows = searchProposals({
    quest,
    capacities: horizon,
    events,
    existingWindows: committed,
    now,
    limit: 3,
  });

  const repo = await getRepository();
  await repo.deleteProposals(quest.id);
  await repo.upsertWindows(windows);

  const { title, note } = describePlan(windows, quest, horizon);
  return { windows, note, title };
}

/* -------------------------------------------------------------------------- */
/* Chat                                                                        */
/* -------------------------------------------------------------------------- */

type Intent = 'new-quest' | 'explain-today' | 'plan' | 'general';

const NEW_QUEST_RE =
  /\b(i want to|i'd like to|i would like to|i wanna|get back into|get back to|start learning|learn how to|pick up|take up|teach myself|new quest|start a quest)\b/i;
const EXPLAIN_TODAY_RE =
  /\b(why|tonight|today|capacity|recovery|strain|sleep|tired|exhausted|wrecked|depleted|rest day|nothing)\b/i;
const PLAN_RE =
  /\b(plan|schedule|when|book|slot|window|fit|free|this week|next week|time for|replan)\b/i;

/** Cheap and legible on purpose — a mis-read intent still answers with real numbers. */
function classify(message: string): Intent {
  if (NEW_QUEST_RE.test(message)) return 'new-quest';
  if (EXPLAIN_TODAY_RE.test(message)) return 'explain-today';
  if (PLAN_RE.test(message)) return 'plan';
  return 'general';
}

/** Their quest if they named it, otherwise the one they are actually running. */
function pickQuest(snapshot: MemberSnapshot, message: string): Quest | undefined {
  const text = message.toLowerCase();
  const named = snapshot.quests.find(
    (q) =>
      q.status === 'active' &&
      (text.includes(q.category) ||
        q.title
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.length > 4 && text.includes(word))),
  );
  return named ?? snapshot.quests.find((q) => q.status === 'active') ?? snapshot.quests[0];
}

function capacityFacts(capacity: DayCapacity): string[] {
  const weakest = [...capacity.factors].sort((a, b) => a.normalised - b.normalised)[0];
  const facts = [
    capacityLine(capacity),
    `Weakest signal: ${weakest.label} — ${weakest.detail}.`,
    `Hobby time the agent will place today: ${capacity.dailyBudgetMinutes} minutes.`,
  ];
  if (capacity.meetingMinutes > 0) {
    facts.push(
      `Calendar today: ${durationLabel(capacity.meetingMinutes)} of meetings, longest unbroken run ${capacity.longestMeetingRun} minutes.`,
    );
  }
  return facts;
}

function todayDraft(snapshot: MemberSnapshot, nudge: Nudge | undefined): string {
  const capacity = snapshot.today;
  const todayKey = capacity.date;
  const held = snapshot.windows.find(
    (w) => w.date === todayKey && (w.status === 'accepted' || w.status === 'proposed'),
  );

  /**
   * The headline is already built from the weakest factor, so naming that
   * factor again here just says the same thing twice. The raw metric still
   * reaches the model through FACTS, where it costs the reader nothing.
   */
  const parts = [
    `Capacity is ${capacity.score} out of 100 today — ${BAND_COPY[capacity.band].label.toLowerCase()}.`,
    capacity.headline,
  ];

  if (capacity.dailyBudgetMinutes === 0) {
    parts.push('So I am not booking anything. Play anyway if you want — I just will not make it something you owe.');
  } else if (held) {
    parts.push(`You have ${durationLabel(held.minutes)} held at ${clockTime(held.start)}. Still looks right.`);
  } else {
    parts.push(`Room for about ${durationLabel(capacity.dailyBudgetMinutes)} if you want it.`);
  }

  if (nudge) parts.push(nudgeSentence(nudge));
  return parts.join(' ');
}

function nudgeSentence(nudge: Nudge): string {
  const reason = nudge.reasons[0] ?? '';
  // Deliberately the last thing said, and deliberately framed as private —
  // the whole point of the nudge is that it never becomes a scoreboard.
  return `One private thing: ${nudge.title}. ${reason} Only you see this.`;
}

function generalDraft(snapshot: MemberSnapshot, quest: Quest | undefined, nudge: Nudge | undefined): string {
  const parts = [
    `Capacity is ${snapshot.today.score} out of 100 today. ${snapshot.today.headline}`,
  ];

  if (quest) {
    const streak = snapshot.streaks[quest.id];
    if (streak) {
      parts.push(
        `"${quest.title}" is ${HEALTH_COPY[streak.health].label.toLowerCase()} — ${streak.weeks} ${streak.weeks === 1 ? 'week' : 'weeks'} running, ${durationLabel(streak.minutesThisWeek)} logged this week against a ${durationLabel(quest.weeklyMinutesTarget)} ceiling.`,
      );
    }
    parts.push('Ask me to plan it and I will take the rest of the week into account.');
  } else {
    parts.push('Tell me what you were doing before work ate it and I will build the ladder.');
  }

  if (nudge) parts.push(nudgeSentence(nudge));
  return parts.join(' ');
}

interface Reply {
  draft: string;
  facts: string[];
  actions: AgentAction[];
}

async function buildReply(
  intent: Intent,
  userId: UserId,
  message: string,
  snapshot: MemberSnapshot,
  nudge: Nudge | undefined,
): Promise<Reply> {
  const facts = capacityFacts(snapshot.today);

  if (intent === 'new-quest') {
    const quest = await draftQuestFromGoal(message, userId);
    const actions: AgentAction[] = [{ type: 'quest-drafted', quest }];
    facts.push(questLine(quest));
    facts.push(
      `Milestone ladder: ${quest.milestones.map((m) => m.title).join('; ')}.`,
    );

    let draft = `Started "${quest.title}". ${quest.milestones.length} rungs, first is "${quest.milestones[0].title}". ${quest.sessionMinutes}-minute sessions, ${durationLabel(quest.weeklyMinutesTarget)} a week as a ceiling.`;

    // Plan it straight away — a quest with no time attached is a to-do list.
    const plan = await planQuest(quest.id, userId);
    facts.push(plan.note);
    draft = `${draft} ${plan.note}`;
    if (plan.windows.length > 0) {
      actions.push({ type: 'windows-proposed', windows: plan.windows });
    }
    return { draft, facts, actions };
  }

  if (intent === 'plan') {
    const quest = pickQuest(snapshot, message);
    if (!quest) {
      return {
        draft: 'No active quest yet. Tell me what you keep meaning to get back to and I will build the ladder.',
        facts,
        actions: [{ type: 'none' }],
      };
    }

    const plan = await planQuest(quest.id, userId);
    facts.push(questLine(quest));
    facts.push(plan.note);
    for (const w of plan.windows) {
      facts.push(
        `Block: ${relativeDay(w.date, snapshot.today.date)} ${clockTime(w.start)}, ${durationLabel(w.minutes)}, fit ${w.score} out of 100. ${w.rationale.join(' ')}`,
      );
    }

    return {
      draft: plan.note,
      facts,
      actions:
        plan.windows.length > 0
          ? [{ type: 'windows-proposed', windows: plan.windows }]
          : [{ type: 'none' }],
    };
  }

  if (intent === 'explain-today') {
    if (nudge) facts.push(`Private nudge for them: ${nudge.title} — ${nudge.reasons.join(' ')}`);
    return { draft: todayDraft(snapshot, nudge), facts, actions: [{ type: 'none' }] };
  }

  const quest = pickQuest(snapshot, message);
  if (quest) facts.push(questLine(quest));
  if (nudge) facts.push(`Private nudge for them: ${nudge.title} — ${nudge.reasons.join(' ')}`);
  return { draft: generalDraft(snapshot, quest, nudge), facts, actions: [{ type: 'none' }] };
}

export async function chatWithAgent(userId: UserId, message: string): Promise<AgentMessage> {
  const repo = await getRepository();
  const asked = new Date();
  const trimmed = message.trim();

  await repo.insertMessage(
    {
      id: `m_${asked.getTime().toString(36)}_u`,
      role: 'user',
      content: trimmed,
      createdAt: iso(asked),
    },
    userId,
  );

  const [snapshot, nudges, history] = await Promise.all([
    getSnapshot(userId),
    getNudges(userId),
    getConversation(userId),
  ]);
  const nudge = nudges.find((n) => n.toUserId === userId && n.status === 'open');

  const { draft, facts, actions } = await buildReply(
    classify(trimmed),
    userId,
    trimmed,
    snapshot,
    nudge,
  );

  // The model gets the finished answer and the numbers behind it, and is asked
  // for a better sentence. If it declines, is slow, or is not configured, the
  // draft ships as written.
  const narrated = isLLMEnabled()
    ? await complete({
        system: CHAT_SYSTEM,
        user: chatUserPrompt({
          lines: facts,
          draft,
          // The turn we just stored is passed separately as `message`.
          history: history.slice(-7, -1).map((m) => `${m.role}: ${m.content}`),
          message: trimmed,
        }),
        maxTokens: 400,
      })
    : null;

  const answered = new Date();
  const reply: AgentMessage = {
    id: `m_${answered.getTime().toString(36)}_a`,
    role: 'agent',
    content: narrated ?? draft,
    createdAt: iso(answered),
    actions: actions.some((a) => a.type !== 'none') ? actions : undefined,
  };

  await repo.insertMessage(reply, userId);
  return reply;
}
