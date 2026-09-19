import { QuestStudio } from '@/components/quests/quest-studio';
import type { RingPhoto } from '@/components/quests/quest-studio';
import { getConversation, getFeed, getMembers, getSnapshot, VIEWER_ID } from '@/lib/data/service';
import { timeAgo } from '@/lib/domain/time';

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

  const now = new Date();

  // Only real photos orbit the orb.
  const photos: RingPhoto[] = feed
    .filter((e) => Boolean(e.post.photoUrl))
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
        post: e.post,
        author: e.author,
        postedAgo: timeAgo(e.post.createdAt, now),
      };
    });

  return (
    <QuestStudio
      viewerId={VIEWER_ID}
      members={members}
      teammates={members.filter((m) => m.id !== snapshot.member.id)}
      quests={snapshot.quests}
      streaks={snapshot.streaks}
      photos={photos}
      initialMessages={conversation}
    />
  );
}
