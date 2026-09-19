import { Compass } from 'lucide-react';

import { NewQuestForm } from '@/components/quests/new-quest-form';
import { QuestCard } from '@/components/quests/quest-card';
import { getSnapshot } from '@/lib/data/service';

/**
 * The landing page. Whatever the viewer is actually working on leads; the
 * composer sits above it because typing a sentence and getting a ladder back
 * is the thing to show first.
 *
 * The world is generated relative to "now" and mutated in place by the quest
 * routes, so this page must never be prerendered at build time.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Quests · SideQuest',
};

export default async function QuestsPage() {
  const { quests, streaks } = await getSnapshot();

  const active = quests.filter((q) => q.status === 'active');
  const resting = quests.filter((q) => q.status !== 'active');

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Quests</h1>
        <p className="text-[13px] text-muted-foreground">
          A ladder of real steps, and a weekly ceiling the agent will not book past.
        </p>
      </header>

      <NewQuestForm />

      {active.length > 0 ? (
        <div className="space-y-3">
          {active.map((quest) => (
            <QuestCard key={quest.id} quest={quest} streak={streaks[quest.id]} />
          ))}
        </div>
      ) : (
        <div className="glass-panel p-6 text-center">
          <div className="relative z-10">
            <Compass className="mx-auto size-5 text-primary" aria-hidden />
            <p className="mt-2 text-[14px] font-medium text-foreground">No quest yet</p>
            <p className="mx-auto mt-0.5 max-w-sm text-[13px] text-muted-foreground">
              Name the thing you keep meaning to get back to. The agent finds the hours.
            </p>
          </div>
        </div>
      )}

      {resting.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Resting · nothing is deleted for going quiet
          </h2>
          <div className="space-y-2">
            {resting.map((quest) => (
              <QuestCard key={quest.id} quest={quest} streak={streaks[quest.id]} dense />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
