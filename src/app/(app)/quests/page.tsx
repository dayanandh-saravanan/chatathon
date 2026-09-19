import { Compass } from 'lucide-react';

import { NewQuestForm } from '@/components/quests/new-quest-form';
import { QuestCard } from '@/components/quests/quest-card';
import { getSnapshot } from '@/lib/data/service';

/**
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
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Quests
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          The thing you were doing before the calendar filled up. Each quest is a short ladder of
          real steps, paced to weeks rather than days, with a weekly ceiling the agent will not
          book past.
        </p>
      </header>

      <NewQuestForm />

      {active.length > 0 ? (
        <div className="space-y-6">
          {active.map((quest, i) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              streak={streaks[quest.id]}
              showStreakExplainer={i === 0}
            />
          ))}
        </div>
      ) : (
        <div className="glass-panel p-10 text-center">
          <div className="relative z-10">
            <span className="gradient-purple-blue mx-auto flex size-12 items-center justify-center rounded-2xl shadow-soft">
              <Compass className="size-6 text-white" aria-hidden />
            </span>
            <p className="mt-4 text-base font-medium text-foreground">No quest yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Write down the thing you keep meaning to get back to. The agent will break it into
              steps and then go looking for the hours.
            </p>
          </div>
        </div>
      )}

      {resting.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Resting
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Paused and finished quests stay here. Nothing is deleted for going quiet.
          </p>
          <div className="space-y-6">
            {resting.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                streak={streaks[quest.id]}
                showStreakExplainer={false}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
