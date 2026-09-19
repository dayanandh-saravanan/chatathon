import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { Repository } from '@/lib/data/repository';
import type { QuestWindow } from '@/lib/domain/types';
import { getRepository } from '@/lib/data';
import { ensureSeeded, getQuest } from '@/lib/data/service';
import { iso } from '@/lib/domain/time';

/**
 * Accept, decline or complete one proposed block.
 */
export const dynamic = 'force-dynamic';

const WindowBody = z.object({
  status: z.enum(['accepted', 'declined', 'completed']),
});

/**
 * A finished session is the only thing that moves a quest forward. Walking the
 * ladder here rather than in the client keeps progress consistent no matter
 * which surface marked the block done.
 */
async function advanceLadder(repo: Repository, questWindow: QuestWindow): Promise<void> {
  const quest = await getQuest(questWindow.questId);
  if (!quest) return;

  const milestone =
    quest.milestones.find((m) => m.id === questWindow.milestoneId && m.status !== 'done') ??
    quest.milestones.find((m) => m.status === 'current');
  if (!milestone) return;

  const sessionsDone = milestone.sessionsDone + 1;
  if (sessionsDone < milestone.estimatedSessions) {
    await repo.updateMilestone(milestone.id, { sessionsDone });
    return;
  }

  await repo.updateMilestone(milestone.id, {
    sessionsDone,
    status: 'done',
    completedAt: iso(new Date()),
  });

  const next = quest.milestones
    .filter((m) => m.id !== milestone.id && m.status === 'locked')
    .sort((a, b) => a.order - b.order)[0];

  if (next) await repo.updateMilestone(next.id, { status: 'current' });
  else await repo.updateQuestStatus(quest.id, 'done');
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const json = await request.json().catch(() => null);
    const parsed = WindowBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Status must be accepted, declined or completed.' },
        { status: 400 },
      );
    }

    await ensureSeeded();
    const repo = await getRepository();

    // Read the prior status first so a double-tap on "done" cannot advance the
    // ladder twice. Copy the value out — the in-memory store hands back a live
    // object that the update below mutates in place.
    const before = (await repo.listWindows()).find((w) => w.id === id);
    if (!before) {
      return NextResponse.json({ error: 'That block does not exist.' }, { status: 404 });
    }
    const wasCompleted = before.status === 'completed';

    const updated = await repo.updateWindowStatus(id, parsed.data.status);
    if (!updated) {
      return NextResponse.json({ error: 'That block does not exist.' }, { status: 404 });
    }

    if (parsed.data.status === 'completed' && !wasCompleted) {
      await advanceLadder(repo, updated);
    }

    return NextResponse.json({ window: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update that block.' },
      { status: 500 },
    );
  }
}
