import { NextResponse } from 'next/server';
import { z } from 'zod';

import { planQuest } from '@/lib/agent';
import { ensureSeeded, getQuest } from '@/lib/data/service';

/**
 * Re-plans one quest. The agent owns the decision — including the decision to
 * propose nothing — so this handler only resolves the quest's owner and hands
 * over. `note` carries the refusal when `windows` comes back empty.
 */
export const dynamic = 'force-dynamic';

const PlanBody = z.object({ questId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = PlanBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Expected a questId.' }, { status: 400 });
    }

    await ensureSeeded();
    const quest = await getQuest(parsed.data.questId);
    if (!quest) {
      return NextResponse.json({ error: 'That quest does not exist.' }, { status: 404 });
    }

    const result = await planQuest(quest.id, quest.ownerId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'The planner failed.' },
      { status: 500 },
    );
  }
}
