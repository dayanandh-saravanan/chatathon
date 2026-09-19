import { PostCard } from '@/components/feed/post-card';
import { PostComposer } from '@/components/feed/post-composer';
import { getFeed, getSnapshot, VIEWER_ID } from '@/lib/data/service';
import { timeAgo } from '@/lib/domain/time';

export const metadata = {
  title: 'Feed · SideQuest',
};

/** The in-memory store mutates as the demo runs, so this can never be prerendered. */
export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const [feed, snapshot] = await Promise.all([getFeed(), getSnapshot(VIEWER_ID)]);

  // One clock for the whole render keeps every "2d ago" mutually consistent.
  const now = new Date();
  const composerQuests = snapshot.quests
    .filter((q) => q.status !== 'done')
    .map((q) => ({ id: q.id, title: q.title }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-16">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Feed
        </h1>
        <p className="text-sm text-muted-foreground">
          Proof that people are still doing the thing. Minutes, milestones and rest days all
          land here the same way, and none of it is ranked.
        </p>
      </header>

      <PostComposer quests={composerQuests} />

      {feed.length === 0 ? (
        <div className="glass-panel rounded-3xl p-6 shadow-soft">
          <p className="relative z-10 text-sm text-muted-foreground">
            Nothing here yet. The first post is usually the hardest one.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {feed.map(({ post, author, quest }) => (
            <PostCard
              key={post.id}
              post={post}
              author={author}
              questTitle={quest?.title}
              postedAgo={timeAgo(post.createdAt, now)}
              viewerId={VIEWER_ID}
            />
          ))}
        </div>
      )}

      <p className="px-1 text-center text-xs text-muted-foreground">
        No streak rankings, no top performers. Everyone is somewhere different.
      </p>
    </div>
  );
}
