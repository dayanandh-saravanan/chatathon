import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getRepository } from '@/lib/data';
import { ensureSeeded, getMembers } from '@/lib/data/service';

/**
 * Attach a profile photo to a member, or clear it with `null`.
 *
 * The URL is expected to be a path this app already serves — normally one
 * handed back by `POST /api/upload`. Absolute URLs are refused so a photo can
 * never become a third-party tracking pixel rendered on every page.
 */
export const dynamic = 'force-dynamic';

const PhotoBody = z.object({
  photoUrl: z
    .string()
    .trim()
    .max(300)
    .regex(/^\/(people|posts)\/[A-Za-z0-9._-]+$/, 'Upload the photo first.')
    .nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = PhotoBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Send an uploaded photo path, or null to remove it.' },
        { status: 400 },
      );
    }

    await ensureSeeded();
    const member = (await getMembers()).find((m) => m.id === id);
    if (!member) {
      return NextResponse.json({ error: 'That member does not exist.' }, { status: 404 });
    }

    const repo = await getRepository();
    await repo.setMemberPhoto(id, parsed.data.photoUrl);

    return NextResponse.json({
      member: { ...member, photoUrl: parsed.data.photoUrl ?? undefined },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save that photo.' },
      { status: 500 },
    );
  }
}
