import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { Post } from '@/lib/domain/types';
import { getRepository } from '@/lib/data';
import { VIEWER_ID, ensureSeeded, getQuest } from '@/lib/data/service';
import { iso } from '@/lib/domain/time';

/**
 * Proof of progress. A post is evidence someone showed up, never a score —
 * nothing here is ranked or compared between people.
 */
export const dynamic = 'force-dynamic';

const PostBody = z.object({
  questId: z.string().min(1),
  body: z.string().trim().min(1).max(600),
  kind: z.enum(['progress', 'milestone', 'rest', 'restart']).optional(),
  glyph: z.string().trim().min(1).max(8).optional(),
  minutes: z.number().int().positive().max(600).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = PostBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Pick a quest and write a line.' }, { status: 400 });
    }

    await ensureSeeded();
    const quest = await getQuest(parsed.data.questId);
    if (!quest) {
      return NextResponse.json({ error: 'That quest does not exist.' }, { status: 400 });
    }

    const now = new Date();
    const kind = parsed.data.kind ?? 'progress';
    const post: Post = {
      // Stable and monotonic, so the feed orders correctly without a database
      // sequence behind it.
      id: `p_${now.getTime().toString(36)}`,
      authorId: VIEWER_ID,
      questId: quest.id,
      kind,
      body: parsed.data.body,
      glyph: parsed.data.glyph ?? '✨',
      minutes: parsed.data.minutes,
      milestoneTitle:
        kind === 'milestone'
          ? quest.milestones.find((m) => m.status === 'current')?.title
          : undefined,
      createdAt: iso(now),
      cheers: [],
    };

    const saved = await (await getRepository()).insertPost(post);
    return NextResponse.json({ post: saved }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save that post.' },
      { status: 500 },
    );
  }
}
