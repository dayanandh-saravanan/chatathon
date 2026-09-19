import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { PostComposer } from '@/components/feed/post-composer';
import { getSnapshot, VIEWER_ID } from '@/lib/data/service';

export const metadata = {
  title: 'New post · SideQuest',
};

/** Reads the live store, which the demo mutates as it runs. */
export const dynamic = 'force-dynamic';

export default async function NewPostPage() {
  const snapshot = await getSnapshot(VIEWER_ID);

  const quests = snapshot.quests
    .filter((q) => q.status !== 'done')
    .map((q) => ({ id: q.id, title: q.title }));

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 pb-12">
      <header className="flex items-center gap-2">
        <Link
          href="/feed"
          aria-label="Back to feed"
          className="grid size-7 place-items-center rounded-full text-muted-foreground animate-smooth hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">New post</h1>
      </header>

      <PostComposer quests={quests} />
    </div>
  );
}
