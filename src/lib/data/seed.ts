import type {
  CalendarEvent,
  DailySignal,
  Milestone,
  Post,
  Quest,
  QuestWindow,
  TeamMember,
  UserId,
} from '@/lib/domain/types';
import {
  addDays,
  at,
  dateKey,
  iso,
  seededInt,
  seededUnit,
  startOfWeek,
} from '@/lib/domain/time';

/**
 * Demo seed.
 *
 * Everything is generated relative to "now" and from string seeds, so the
 * dataset is both always-current and byte-identical between the server render
 * and the client hydration. No `Math.random()`, no frozen 2024 dates.
 *
 * The narrative is deliberate — it is what gets demoed:
 *   · Travis is mid-streak and today is a wall. The agent refuses to schedule.
 *   · Hank has gone quiet for 13 days. One teammate gets told, privately.
 *   · Ryan is thriving. Nobody is ranked against him.
 */

export const TEAM: TeamMember[] = [
  {
    id: 'u_travis',
    name: 'Travis Peng',
    handle: 'travis',
    role: 'Product Engineering',
    initials: 'TP',
    accent: '262 52% 62%',
    timezone: 'America/New_York',
    joinedAt: '2024-08-19T13:00:00.000Z',
  },
  {
    id: 'u_ethan',
    name: 'Ethan Alvarez',
    handle: 'ethan',
    role: 'Design',
    initials: 'EA',
    accent: '217 85% 56%',
    timezone: 'America/New_York',
    joinedAt: '2024-06-03T13:00:00.000Z',
  },
  {
    id: 'u_ryan',
    name: 'Ryan Okafor',
    handle: 'ryan',
    role: 'Data',
    initials: 'RO',
    accent: '142 60% 48%',
    timezone: 'America/New_York',
    joinedAt: '2023-11-13T13:00:00.000Z',
  },
  {
    id: 'u_hank',
    name: 'Hank Delacroix',
    handle: 'hank',
    role: 'Platform',
    initials: 'HD',
    accent: '38 85% 52%',
    timezone: 'America/Chicago',
    joinedAt: '2024-02-05T13:00:00.000Z',
  },
  {
    id: 'u_dhan',
    name: 'Dhan Rao',
    handle: 'dhan',
    role: 'Growth',
    initials: 'DR',
    accent: '336 72% 58%',
    timezone: 'America/Los_Angeles',
    joinedAt: '2024-09-30T13:00:00.000Z',
  },
  {
    id: 'u_sid',
    name: 'Sid Kaur',
    handle: 'sid',
    role: 'Support Lead',
    initials: 'SK',
    accent: '195 92% 52%',
    timezone: 'America/New_York',
    joinedAt: '2025-01-21T13:00:00.000Z',
  },
];

export const VIEWER_ID: UserId = 'u_travis';

/** How far back and forward the generated world extends. */
export const HISTORY_WEEKS = 4;
export const FUTURE_DAYS = 10;

function milestone(
  questId: string,
  order: number,
  title: string,
  detail: string,
  estimatedSessions: number,
  sessionsDone: number,
  status: Milestone['status'],
): Milestone {
  return {
    id: `${questId}_m${order}`,
    questId,
    order,
    title,
    detail,
    estimatedSessions,
    sessionsDone,
    status,
  };
}

export function buildQuests(now: Date): Quest[] {
  const created = (weeksAgo: number) => iso(addDays(now, -7 * weeksAgo));
  const target = (weeksAhead: number) => dateKey(addDays(now, 7 * weeksAhead));

  const quests: Quest[] = [
    {
      id: 'q_guitar',
      ownerId: 'u_travis',
      title: 'Play three Bruno Mars songs start to finish',
      category: 'music',
      why: 'I bought the guitar in March and it has been furniture since May.',
      targetDate: target(11),
      weeklyMinutesTarget: 120,
      sessionMinutes: 45,
      status: 'active',
      createdAt: created(6),
      milestones: [
        milestone('q_guitar', 1, 'Clean chord changes', 'G–C–D and Am–F without looking down.', 6, 6, 'done'),
        milestone('q_guitar', 2, 'Talking to the Moon, verse + chorus', 'Slow, with a metronome at 70bpm.', 8, 5, 'current'),
        milestone('q_guitar', 3, 'Count on Me, full song', 'Including the fingerpicked intro.', 8, 0, 'locked'),
        milestone('q_guitar', 4, 'Just the Way You Are, full song', 'Play it end to end for someone else.', 10, 0, 'locked'),
      ],
    },
    {
      id: 'q_half',
      ownerId: 'u_ryan',
      title: 'Finish a half marathon in under 2 hours',
      category: 'fitness',
      why: 'Signed up with my brother. He is faster than me and will not let it go.',
      targetDate: target(14),
      weeklyMinutesTarget: 180,
      sessionMinutes: 55,
      status: 'active',
      createdAt: created(8),
      milestones: [
        milestone('q_half', 1, 'Base: 15km weeks', 'Four easy runs, no pace pressure.', 10, 10, 'done'),
        milestone('q_half', 2, '10km continuous', 'Under 58 minutes, conversational.', 8, 8, 'done'),
        milestone('q_half', 3, '16km long run', 'Fuel practice on the second hour.', 8, 4, 'current'),
        milestone('q_half', 4, 'Race pace tune-up', 'Two 5km repeats at 5:40/km.', 6, 0, 'locked'),
      ],
    },
    {
      id: 'q_cook',
      ownerId: 'u_ethan',
      title: 'Cook twelve dishes I have never made',
      category: 'cooking',
      why: 'I eat the same four meals and I am bored of myself.',
      targetDate: target(12),
      weeklyMinutesTarget: 150,
      sessionMinutes: 60,
      status: 'active',
      createdAt: created(5),
      milestones: [
        milestone('q_cook', 1, 'Four braises', 'Low and slow, one pot, minimal cleanup.', 4, 4, 'done'),
        milestone('q_cook', 2, 'Four fresh pastas', 'Dough by hand, no machine.', 4, 2, 'current'),
        milestone('q_cook', 3, 'Four things I would serve guests', 'Plated, photographed, fed to someone.', 4, 0, 'locked'),
      ],
    },
    {
      id: 'q_keeb',
      ownerId: 'u_hank',
      title: 'Build a keyboard from a bare PCB',
      category: 'craft',
      why: 'I have had the parts in a drawer for four months.',
      targetDate: target(6),
      weeklyMinutesTarget: 90,
      sessionMinutes: 45,
      status: 'active',
      createdAt: created(7),
      milestones: [
        milestone('q_keeb', 1, 'Solder the switches', 'Sixty-eight joints, no bridges.', 4, 4, 'done'),
        milestone('q_keeb', 2, 'Flash the firmware', 'QMK layout compiled and flashed.', 3, 1, 'current'),
        milestone('q_keeb', 3, 'Tune and lube', 'Stabilisers, foam, case fit.', 3, 0, 'locked'),
      ],
    },
    {
      id: 'q_spanish',
      ownerId: 'u_dhan',
      title: 'Hold a ten-minute conversation in Spanish',
      category: 'learning',
      why: 'Half my family speaks it and I answer in English every time.',
      targetDate: target(16),
      weeklyMinutesTarget: 100,
      sessionMinutes: 30,
      status: 'active',
      createdAt: created(4),
      milestones: [
        milestone('q_spanish', 1, 'Present tense, out loud', 'Daily 10-minute speaking drills.', 8, 6, 'current'),
        milestone('q_spanish', 2, 'Past tense survival kit', 'Enough to tell a story about yesterday.', 8, 0, 'locked'),
        milestone('q_spanish', 3, 'Ten unscripted minutes', 'With my aunt, no English fallback.', 6, 0, 'locked'),
      ],
    },
    {
      id: 'q_film',
      ownerId: 'u_sid',
      title: 'Shoot and develop five rolls of film',
      category: 'art',
      why: 'My phone camera made me stop looking at things properly.',
      targetDate: target(9),
      weeklyMinutesTarget: 120,
      sessionMinutes: 50,
      status: 'active',
      createdAt: created(5),
      milestones: [
        milestone('q_film', 1, 'Two rolls shot', 'One colour, one black and white.', 6, 6, 'done'),
        milestone('q_film', 2, 'Develop at home', 'C-41 kit, kitchen sink, no light leaks.', 5, 3, 'current'),
        milestone('q_film', 3, 'Print six frames', 'Pick six, print them, put them on a wall.', 5, 0, 'locked'),
      ],
    },
  ];

  return quests;
}

interface MeetingTemplate {
  title: string;
  hour: number;
  minute: number;
  minutes: number;
  attendees: number;
}

const RECURRING: Record<UserId, MeetingTemplate[]> = {
  u_travis: [
    { title: 'Standup', hour: 9, minute: 30, minutes: 15, attendees: 8 },
    { title: 'Design review', hour: 11, minute: 0, minutes: 60, attendees: 6 },
    { title: '1:1 with Maya', hour: 14, minute: 0, minutes: 30, attendees: 2 },
  ],
  u_ethan: [
    { title: 'Standup', hour: 9, minute: 30, minutes: 15, attendees: 8 },
    { title: 'Critique', hour: 13, minute: 0, minutes: 60, attendees: 5 },
  ],
  u_ryan: [
    { title: 'Standup', hour: 9, minute: 30, minutes: 15, attendees: 8 },
    { title: 'Metrics review', hour: 15, minute: 0, minutes: 45, attendees: 7 },
  ],
  u_hank: [
    { title: 'Standup', hour: 9, minute: 0, minutes: 15, attendees: 8 },
    { title: 'Incident review', hour: 10, minute: 0, minutes: 60, attendees: 9 },
    { title: 'Platform sync', hour: 13, minute: 30, minutes: 45, attendees: 6 },
    { title: 'On-call handoff', hour: 16, minute: 0, minutes: 30, attendees: 4 },
  ],
  u_dhan: [
    { title: 'Standup', hour: 9, minute: 30, minutes: 15, attendees: 8 },
    { title: 'Campaign sync', hour: 12, minute: 0, minutes: 45, attendees: 5 },
  ],
  u_sid: [
    { title: 'Standup', hour: 9, minute: 30, minutes: 15, attendees: 8 },
    { title: 'Queue triage', hour: 11, minute: 30, minutes: 45, attendees: 4 },
    { title: 'Customer call', hour: 15, minute: 30, minutes: 45, attendees: 3 },
  ],
};

const EXTRA_POOL: MeetingTemplate[] = [
  { title: 'Roadmap workshop', hour: 10, minute: 0, minutes: 90, attendees: 12 },
  { title: 'Vendor call', hour: 16, minute: 0, minutes: 45, attendees: 4 },
  { title: 'All hands', hour: 13, minute: 0, minutes: 60, attendees: 40 },
  { title: 'Interview loop', hour: 15, minute: 0, minutes: 60, attendees: 3 },
  { title: 'Deep work block', hour: 8, minute: 0, minutes: 90, attendees: 1 },
  { title: 'Postmortem', hour: 14, minute: 30, minutes: 60, attendees: 8 },
];

/**
 * Today is engineered to be a wall for the viewer: five and a half hours of
 * meetings with a three-hour unbroken run. That is the moment the product is
 * actually about — the agent looks at it and schedules nothing.
 */
const VIEWER_TODAY_OVERRIDE: MeetingTemplate[] = [
  { title: 'Standup', hour: 9, minute: 30, minutes: 15, attendees: 8 },
  { title: 'Quarterly planning', hour: 10, minute: 0, minutes: 120, attendees: 14 },
  { title: 'Planning readout', hour: 12, minute: 0, minutes: 60, attendees: 9 },
  { title: 'Customer escalation', hour: 13, minute: 0, minutes: 75, attendees: 6 },
  { title: 'Design review', hour: 15, minute: 0, minutes: 60, attendees: 6 },
  { title: '1:1 with Maya', hour: 16, minute: 30, minutes: 30, attendees: 2 },
];

export function buildCalendar(now: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const firstDay = addDays(startOfWeek(now), -7 * HISTORY_WEEKS);
  const totalDays = 7 * HISTORY_WEEKS + FUTURE_DAYS + 7;
  const todayKey = dateKey(now);

  for (const member of TEAM) {
    for (let i = 0; i < totalDays; i += 1) {
      const day = addDays(firstDay, i);
      const key = dateKey(day);
      const isViewerToday = member.id === VIEWER_ID && key === todayKey;

      const dow = day.getDay();
      // Weekends stay clear of work — except the viewer's today, which is the
      // engineered wall the demo is built around and must land on any weekday
      // or weekend the product happens to be shown on.
      if ((dow === 0 || dow === 6) && !isViewerToday) continue;

      const base = isViewerToday ? VIEWER_TODAY_OVERRIDE : RECURRING[member.id];

      for (const t of base) {
        const start = at(day, t.hour, t.minute);
        events.push({
          id: `e_${member.id}_${key}_${t.hour}${t.minute}`,
          ownerId: member.id,
          title: t.title,
          kind: t.title.startsWith('Deep work') ? 'focus' : 'meeting',
          start: iso(start),
          end: iso(new Date(start.getTime() + t.minutes * 60_000)),
          attendees: t.attendees,
        });
      }

      if (isViewerToday) continue;

      // Deterministic extra load so weeks differ from each other believably.
      const roll = seededUnit(`${member.id}:${key}:extra`);
      if (roll > 0.52) {
        const pick = EXTRA_POOL[seededInt(`${member.id}:${key}:pick`, 0, EXTRA_POOL.length - 1)];
        const start = at(day, pick.hour, pick.minute);
        events.push({
          id: `e_${member.id}_${key}_x`,
          ownerId: member.id,
          title: pick.title,
          kind: pick.title.startsWith('Deep work') ? 'focus' : 'meeting',
          start: iso(start),
          end: iso(new Date(start.getTime() + pick.minutes * 60_000)),
          attendees: pick.attendees,
        });
      }
      if (roll > 0.86) {
        const start = at(day, 17, 0);
        events.push({
          id: `e_${member.id}_${key}_late`,
          ownerId: member.id,
          title: 'Late sync with EMEA',
          kind: 'meeting',
          start: iso(start),
          end: iso(new Date(start.getTime() + 45 * 60_000)),
          attendees: 5,
        });
      }
    }
  }

  return events;
}

/** Per-member signal personality: [recoveryBase, sleepBase, strainBase]. */
const SIGNAL_PROFILE: Record<UserId, [number, number, number]> = {
  u_travis: [58, 6.9, 11.5],
  u_ethan: [66, 7.3, 10.2],
  u_ryan: [71, 7.6, 14.5],
  u_hank: [47, 6.2, 12.8],
  u_dhan: [63, 7.1, 9.6],
  u_sid: [69, 7.4, 10.8],
};

/** Today for the viewer is pinned low so the "we scheduled nothing" beat lands. */
const VIEWER_TODAY_SIGNAL = {
  recovery: 31,
  sleepHours: 5.6,
  sleepDebtMinutes: 95,
  dayStrain: 14.2,
  restingHr: 63,
  hrvMs: 38,
};

export function buildSignals(now: Date): DailySignal[] {
  const signals: DailySignal[] = [];
  const firstDay = addDays(startOfWeek(now), -7 * HISTORY_WEEKS);
  const totalDays = 7 * HISTORY_WEEKS + FUTURE_DAYS + 7;
  const todayKey = dateKey(now);

  for (const member of TEAM) {
    const [recoveryBase, sleepBase, strainBase] = SIGNAL_PROFILE[member.id];

    for (let i = 0; i < totalDays; i += 1) {
      const day = addDays(firstDay, i);
      const key = dateKey(day);

      if (member.id === VIEWER_ID && key === todayKey) {
        signals.push({ ownerId: member.id, date: key, source: 'whoop-sim', ...VIEWER_TODAY_SIGNAL });
        continue;
      }

      const jitter = (tag: string, spread: number) =>
        (seededUnit(`${member.id}:${key}:${tag}`) - 0.5) * 2 * spread;

      // Weekends recover better; mid-week is where the hole gets dug.
      const dow = day.getDay();
      const weekendLift = dow === 0 || dow === 6 ? 9 : 0;
      const midweekDip = dow === 3 || dow === 4 ? -5 : 0;

      const recovery = Math.round(
        Math.min(98, Math.max(12, recoveryBase + weekendLift + midweekDip + jitter('rec', 18))),
      );
      const sleepHours =
        Math.round((sleepBase + (weekendLift ? 0.7 : 0) + jitter('slp', 1.1)) * 10) / 10;
      const sleepDebtMinutes = Math.max(0, Math.round((7.8 - sleepHours) * 60));
      const dayStrain =
        Math.round((strainBase + jitter('str', 3.4)) * 10) / 10;

      signals.push({
        ownerId: member.id,
        date: key,
        recovery,
        sleepHours,
        sleepDebtMinutes,
        dayStrain: Math.max(2, Math.min(20.8, dayStrain)),
        restingHr: 52 + Math.round((100 - recovery) / 7),
        hrvMs: 28 + Math.round(recovery / 2.1),
        source: 'whoop-sim',
      });
    }
  }

  return signals;
}

/** Per-quest session history shape: how many weeks back it has been alive and how reliably. */
const HISTORY_SHAPE: Record<
  string,
  { weeks: number; perWeek: number; hitRate: number; quietWeeks: number }
> = {
  q_guitar: { weeks: 5, perWeek: 2, hitRate: 0.82, quietWeeks: 0 },
  q_half: { weeks: 6, perWeek: 3, hitRate: 0.93, quietWeeks: 0 },
  q_cook: { weeks: 4, perWeek: 2, hitRate: 0.78, quietWeeks: 0 },
  // Hank stopped two weeks ago. This is what generates the private check-in.
  q_keeb: { weeks: 5, perWeek: 2, hitRate: 0.7, quietWeeks: 2 },
  q_spanish: { weeks: 3, perWeek: 3, hitRate: 0.66, quietWeeks: 0 },
  q_film: { weeks: 4, perWeek: 2, hitRate: 0.85, quietWeeks: 0 },
};

/** Weekday + hour each quest historically landed on, so history looks like a habit. */
const HISTORY_SLOTS: Record<string, Array<[number, number]>> = {
  q_guitar: [[2, 19], [4, 19], [6, 11]],
  q_half: [[1, 7], [3, 7], [6, 8]],
  q_cook: [[3, 18], [0, 17], [5, 18]],
  q_keeb: [[1, 20], [4, 20], [6, 14]],
  q_spanish: [[1, 8], [2, 8], [4, 8]],
  q_film: [[5, 16], [6, 10], [3, 18]],
};

export function buildWindowHistory(now: Date, quests: Quest[]): QuestWindow[] {
  const windows: QuestWindow[] = [];
  const thisWeekStart = startOfWeek(now);

  for (const quest of quests) {
    const shape = HISTORY_SHAPE[quest.id];
    const slots = HISTORY_SLOTS[quest.id];
    if (!shape || !slots) continue;

    for (let w = shape.weeks; w >= 0; w -= 1) {
      const weekStart = addDays(thisWeekStart, -7 * w);
      // A quest that has gone quiet simply stops producing sessions.
      if (w < shape.quietWeeks) continue;

      for (let s = 0; s < shape.perWeek; s += 1) {
        const [dow, hour] = slots[s % slots.length];
        const day = addDays(weekStart, dow);
        const start = at(day, hour, 0);
        if (start.getTime() > now.getTime()) continue;

        const roll = seededUnit(`${quest.id}:w${w}:s${s}`);
        const hit = roll < shape.hitRate;
        const minutes = quest.sessionMinutes - (roll > 0.7 ? 10 : 0);

        windows.push({
          id: `wh_${quest.id}_${dateKey(day)}_${hour}`,
          ownerId: quest.ownerId,
          questId: quest.id,
          date: dateKey(day),
          start: iso(start),
          end: iso(new Date(start.getTime() + minutes * 60_000)),
          minutes,
          score: 70 + Math.round(seededUnit(`${quest.id}:score:${w}:${s}`) * 25),
          rationale: ['Scheduled from that week’s capacity forecast.'],
          risks: [],
          status: hit ? 'completed' : 'missed',
          createdAt: iso(addDays(start, -2)),
        });
      }
    }
  }

  return windows;
}

const POST_GLYPHS: Record<string, string[]> = {
  q_guitar: ['🎸', '🎵', '🎼'],
  q_half: ['🏃', '👟', '🥵'],
  q_cook: ['🍝', '🍳', '🥘'],
  q_keeb: ['⌨️', '🔧', '🔌'],
  q_spanish: ['🇪🇸', '📖', '🗣️'],
  q_film: ['📷', '🎞️', '🖼️'],
};

interface PostSeed {
  questId: string;
  daysAgo: number;
  hour: number;
  kind: Post['kind'];
  body: string;
  minutes?: number;
  milestoneTitle?: string;
  cheers: UserId[];
}

const POST_SEEDS: PostSeed[] = [
  {
    questId: 'q_half',
    daysAgo: 1,
    hour: 8,
    kind: 'progress',
    body: '16km done before the standup. The second hour is still where it gets stupid, but I fuelled it right this time.',
    minutes: 96,
    cheers: ['u_travis', 'u_sid', 'u_ethan', 'u_dhan'],
  },
  {
    questId: 'q_cook',
    daysAgo: 1,
    hour: 19,
    kind: 'progress',
    body: 'First pasta dough that did not fight me. Rolled it by hand, which took twice as long and was twice as good.',
    minutes: 65,
    cheers: ['u_ryan', 'u_travis', 'u_sid'],
  },
  {
    questId: 'q_film',
    daysAgo: 2,
    hour: 17,
    kind: 'milestone',
    body: 'Developed my first roll at home. Two frames are ruined and I do not care.',
    minutes: 50,
    milestoneTitle: 'Develop at home',
    cheers: ['u_travis', 'u_ethan', 'u_ryan', 'u_hank', 'u_dhan'],
  },
  {
    questId: 'q_guitar',
    daysAgo: 5,
    hour: 19,
    kind: 'progress',
    body: 'Talking to the Moon, verse and chorus, 70bpm, no stopping. Slow is fine. Slow is the whole trick.',
    minutes: 45,
    cheers: ['u_ryan', 'u_sid', 'u_ethan'],
  },
  {
    questId: 'q_spanish',
    daysAgo: 2,
    hour: 8,
    kind: 'progress',
    body: 'Ten minutes talking to myself about my commute. Riveting content. Present tense is finally automatic.',
    minutes: 30,
    cheers: ['u_travis', 'u_hank'],
  },
  {
    questId: 'q_half',
    daysAgo: 4,
    hour: 7,
    kind: 'rest',
    body: 'Recovery was 34 so SideQuest pulled today’s run and gave me the morning back. Took the morning back.',
    cheers: ['u_ethan', 'u_travis'],
  },
  {
    questId: 'q_keeb',
    daysAgo: 14,
    hour: 20,
    kind: 'progress',
    body: 'Sixty-eight switches soldered, zero bridges. Firmware next week.',
    minutes: 45,
    cheers: ['u_travis', 'u_ryan', 'u_ethan', 'u_sid'],
  },
  {
    questId: 'q_film',
    daysAgo: 6,
    hour: 16,
    kind: 'progress',
    body: 'Shot a roll walking to work instead of listening to a podcast. Noticed about forty things I walk past daily.',
    minutes: 50,
    cheers: ['u_dhan', 'u_travis'],
  },
  {
    questId: 'q_cook',
    daysAgo: 7,
    hour: 18,
    kind: 'milestone',
    body: 'Four braises down. The short rib one is going in the permanent rotation.',
    minutes: 70,
    milestoneTitle: 'Four braises',
    cheers: ['u_ryan', 'u_sid', 'u_hank'],
  },
  {
    questId: 'q_guitar',
    daysAgo: 9,
    hour: 19,
    kind: 'progress',
    body: 'Chord changes are clean now. Six weeks ago I could not get from G to C without looking.',
    minutes: 45,
    cheers: ['u_ethan', 'u_ryan'],
  },
];

export function buildPosts(now: Date, quests: Quest[]): Post[] {
  const byId = new Map(quests.map((q) => [q.id, q]));

  return POST_SEEDS.map((seed, i) => {
    const quest = byId.get(seed.questId);
    const day = addDays(now, -seed.daysAgo);
    const createdAt = at(day, seed.hour, seededInt(`post:${i}:min`, 0, 55));
    const glyphs = POST_GLYPHS[seed.questId] ?? ['✨'];

    return {
      id: `p_${seed.questId}_${seed.daysAgo}`,
      authorId: quest?.ownerId ?? 'u_travis',
      questId: seed.questId,
      kind: seed.kind,
      body: seed.body,
      glyph: glyphs[i % glyphs.length],
      minutes: seed.minutes,
      milestoneTitle: seed.milestoneTitle,
      createdAt: iso(createdAt),
      cheers: seed.cheers.map((userId, c) => ({
        userId,
        emoji: ['🔥', '👏', '💪', '🙌', '👀'][(i + c) % 5],
      })),
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
