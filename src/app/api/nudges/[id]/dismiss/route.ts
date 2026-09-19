import { NextResponse } from 'next/server';

import { getRepository } from '@/lib/data';
import { VIEWER_ID, ensureSeeded } from '@/lib/data/service';

/**
 * Nudges are derived fresh on every read, so dismissing one records the id
 * against the viewer rather than deleting a row.
 */
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing nudge id.' }, { status: 400 });
    }

    await ensureSeeded();
    await (await getRepository()).dismissNudge(id, VIEWER_ID);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not dismiss that nudge.' },
      { status: 500 },
    );
  }
}
