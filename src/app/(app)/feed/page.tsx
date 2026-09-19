import Link from 'next/link';
import { Plus } from 'lucide-react';

import { PostCard } from '@/components/feed/post-card';
import { getFeed, getMembers, VIEWER_ID } from '@/lib/data/service';
import { timeAgo } from '@/lib/domain/time';

export const metadata = {
  title: 'Feed · SideQuest',
};

/** The in-memory store mutates as the demo runs, so this can never be prerendered. */
export const dynamic = 'force-dynamic';

export default async function FeedPage() {
  const [all, members] = await Promise.all([getFeed(), getMembers()]);
  // The feed is photos. A post that never got one is not a card.
  const feed = all.filter((e) => Boolean(e.post.photoUrl));

  // One clock for the whole render keeps every "2d ago" mutually consistent.
  const now = new Date();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 pb-12">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Feed</h1>
          <span className="text-xs text-muted-foreground">Not ranked</span>
        </div>

        <Link
          href="/feed/new"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground shadow-soft animate-smooth hover:opacity-90"
        >
          <Plus className="size-3.5" />
          Post
        </Link>
      </header>

      {feed.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <p className="text-[13px] text-muted-foreground">
            Nothing here yet.{' '}
            <Link href="/feed/new" className="text-primary hover:underline">
              Post the first one.
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {feed.map(({ post, author, quest }) => (
            <PostCard
              key={post.id}
              post={post}
              author={author}
              questTitle={quest?.title}
              postedAgo={timeAgo(post.createdAt, now)}
              viewerId={VIEWER_ID}
              members={members}
            />
          ))}
        </div>
      )}
    </div>
  );
}
