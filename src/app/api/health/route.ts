import { NextResponse } from 'next/server';

import { getRepository } from '@/lib/data';

/**
 * Liveness plus which store is actually live. The app silently falls back to
 * the in-memory repository when Supabase is unreachable, so before a demo the
 * only honest way to know what is backing the data is to ask.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repo = await getRepository();
    return NextResponse.json({ ok: true, repository: repo.kind });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        repository: 'memory' as const,
        error: error instanceof Error ? error.message : 'Health check failed.',
      },
      { status: 500 },
    );
  }
}
