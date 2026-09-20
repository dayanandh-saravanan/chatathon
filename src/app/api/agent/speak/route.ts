import { NextResponse } from 'next/server';
import { z } from 'zod';

import { VOICE_AUDIO_TYPE, isVoiceEnabled, resolveVoice, synthesize } from '@/lib/agent/voice';

/**
 * Speak an agent reply aloud.
 *
 * Two success shapes, both 200: an MP3 body when a voice is configured and
 * responded, or `{ available: false }` when it is not. Silence is a product
 * state, not a failure, so the client never has to render an error for it.
 */
export const dynamic = 'force-dynamic';

const SpeakBody = z.object({
  text: z.string().trim().min(1).max(2000),
});

const silent = () => NextResponse.json({ available: false });

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = SpeakBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nothing to say.' }, { status: 400 });
  }

  if (!isVoiceEnabled()) return silent();

  const audio = await synthesize(parsed.data.text);
  if (!audio) return silent();

  return new NextResponse(audio, {
    status: 200,
    headers: {
      'content-type': VOICE_AUDIO_TYPE,
      'content-length': String(audio.byteLength),
      'cache-control': 'no-store',
    },
  });
}

/** Lets the client decide whether to show a speak control at all. */
export async function GET() {
  if (!isVoiceEnabled()) return NextResponse.json({ available: false });
  const voice = await resolveVoice();
  return NextResponse.json(
    voice ? { available: true, voice: voice.name } : { available: false },
  );
}
