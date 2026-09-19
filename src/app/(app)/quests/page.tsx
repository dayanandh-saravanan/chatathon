import { QuestStudio } from '@/components/quests/quest-studio';
import type { RingPhoto } from '@/components/quests/quest-studio';
import { getConversation, getFeed, getMembers, getSnapshot } from '@/lib/data/service';

/**
 * The landing page is the agent. It opens on the team's photos orbiting the
 * orb; a sentence in the bar becomes a quest, and the page turns into the
 * quest list with the new one on top.
 *
 * The world is generated relative to "now" and mutated in place by the quest
 * routes, so this page must never be prerendered at build time.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Quests · SideQuest',
};

const RING_SIZE = 12;

export default async function QuestsPage() {
  const [snapshot, feed, members, conversation] = await Promise.all([
    getSnapshot(),
    getFeed(),
    getMembers(),
    getConversation(),
  ]);

  // Real photos first, then glyph posts to fill the ring if the team is short.
  const photos: RingPhoto[] = [
    ...feed.filter((e) => e.post.photoUrl),
    ...feed.filter((e) => !e.post.photoUrl),
  ]
    .slice(0, RING_SIZE)
    .map((e) => {
      const author = e.author.name.split(' ')[0];
      return {
        id: e.post.id,
        photoUrl: e.post.photoUrl,
        glyph: e.post.glyph,
        alt: `${author}'s post${e.quest ? ` about ${e.quest.title}` : ''}`,
        authorName: author,
        questTitle: e.quest?.title,
      };
    });

  return (
    <QuestStudio
      teammates={members.filter((m) => m.id !== snapshot.member.id)}
      quests={snapshot.quests}
      streaks={snapshot.streaks}
      photos={photos}
      initialMessages={conversation}
    />
  );
}
