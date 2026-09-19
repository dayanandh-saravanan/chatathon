import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getRepository } from '@/lib/data';
import { VIEWER_ID, ensureSeeded } from '@/lib/data/service';

/**
 * Toggle the viewer's cheer on one post. `emoji: null` removes it.
 */
export const dynamic = 'force-dynamic';

const CheerBody = z.object({
  emoji: z.string().trim().min(1).max(8).nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = CheerBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Send a single emoji, or null to take it back.' },
        { status: 400 },
      );
    }

    await ensureSeeded();
    const repo = await getRepository();
    if (!(await repo.listPosts()).some((p) => p.id === id)) {
      return NextResponse.json({ error: 'That post does not exist.' }, { status: 404 });
    }

    await repo.setCheer(id, VIEWER_ID, parsed.data.emoji);

    // Re-read rather than patching the pre-write copy, so the response is true
    // for a remote store as well as the in-memory one.
    const post = (await repo.listPosts()).find((p) => p.id === id);
    if (!post) {
      return NextResponse.json({ error: 'That post does not exist.' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not record that cheer.' },
      { status: 500 },
    );
  }
}
