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
  /**
   * A path this app already serves, normally straight from `POST /api/upload`.
   * Absolute URLs are refused so a post can never embed a third-party pixel.
   */
  photoUrl: z
    .string()
    .trim()
    .max(300)
    .regex(/^\/posts\/[A-Za-z0-9._-]+$/, 'Upload the photo first.')
    .optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = PostBody.safeParse(json);
    if (!parsed.success) {
      // A bad photo path is a different mistake from a missing quest or body,
      // and saying so is the difference between a fixable error and a shrug.
      const photoIssue = parsed.error.issues.find((i) => i.path[0] === 'photoUrl');
      return NextResponse.json(
        { error: photoIssue ? photoIssue.message : 'Pick a quest and write a line.' },
        { status: 400 },
      );
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
      photoUrl: parsed.data.photoUrl,
      // The glyph is the tile the feed falls back to when there is no photo,
      // so it is written either way.
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
