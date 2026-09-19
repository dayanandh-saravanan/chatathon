import { NextResponse } from 'next/server';
import { z } from 'zod';

import { draftQuestFromGoal } from '@/lib/agent';
import { getRepository } from '@/lib/data';
import { VIEWER_ID, ensureSeeded, getQuest } from '@/lib/data/service';

/**
 * Turns one sentence of intent into a quest with a milestone ladder.
 */
export const dynamic = 'force-dynamic';

const QuestBody = z.object({
  goalText: z.string().trim().min(3).max(500),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = QuestBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Describe the goal in a few words.' },
        { status: 400 },
      );
    }

    await ensureSeeded();
    const quest = await draftQuestFromGoal(parsed.data.goalText, VIEWER_ID);

    // The drafter may or may not have persisted already depending on which
    // path it took; writing only when the row is absent keeps both safe.
    if (!(await getQuest(quest.id))) {
      const repo = await getRepository();
      await repo.insertQuest(quest);
    }

    return NextResponse.json({ quest }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not start that quest.' },
      { status: 500 },
    );
  }
}
