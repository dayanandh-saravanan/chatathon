import { NextResponse } from 'next/server';
import { z } from 'zod';

import { chatWithAgent } from '@/lib/agent';
import { VIEWER_ID, ensureSeeded } from '@/lib/data/service';

/**
 * One conversational turn. Persistence of both the user turn and the reply
 * lives in the agent library, since only it knows which actions the reply
 * carried out; this handler returns the agent's message and nothing else.
 */
export const dynamic = 'force-dynamic';

const ChatBody = z.object({
  message: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = ChatBody.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Say something first.' }, { status: 400 });
    }

    await ensureSeeded();
    const message = await chatWithAgent(VIEWER_ID, parsed.data.message);
    return NextResponse.json({ message });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'The agent did not answer.' },
      { status: 500 },
    );
  }
}
