import type { Metadata } from 'next';

import { MemberCard } from '@/components/team/member-card';
import { PulseHeader } from '@/components/team/pulse-header';
import { VIEWER_ID, getAllStreaks, getTeamCards, getTeamPulse } from '@/lib/data/service';

export const metadata: Metadata = {
  title: 'Team · SideQuest',
};

// The whole world is derived from "now", so a build-time snapshot would freeze
// the demo at whatever day it was compiled.
export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const [pulse, cards, streaks] = await Promise.all([
    getTeamPulse(),
    getTeamCards(),
    getAllStreaks(),
  ]);

  // `questsThriving` and `questsQuiet` are counted over every quest a streak
  // exists for, so that same set is the only honest denominator for the tiles.
  const questsTracked = Object.keys(streaks).length;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-[13px] text-muted-foreground">
          No leaderboard — whoever ranks last is usually having the hardest week.
        </p>
      </header>

      <PulseHeader pulse={pulse} questsTracked={questsTracked} />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <MemberCard
            key={card.member.id}
            member={card.member}
            quest={card.quest}
            streak={card.streak}
            capacity={card.capacity}
            isViewer={card.member.id === VIEWER_ID}
          />
        ))}
      </div>
    </div>
  );
}
