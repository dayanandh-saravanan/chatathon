import type { Metadata } from 'next';
import { Scale } from 'lucide-react';

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
    // The route-group shell already centres and pads the column; a second
    // container here only narrowed this page relative to the other four.
    <div>
      <header className="mb-7">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Team</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          What everyone is keeping alive outside work, and how much room this week left them.
        </p>
      </header>

      <PulseHeader pulse={pulse} questsTracked={questsTracked} />

      <div className="mt-9">
        <h2 className="text-lg font-semibold tracking-tight">Everyone</h2>
        <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
          <Scale className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            No leaderboard, on purpose — whoever ranks last is usually whoever is having the
            hardest week, and watching that happen in public is how people quit.
          </span>
        </p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
