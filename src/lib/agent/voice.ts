import 'server-only';

/**
 * The agent's speaking voice.
 *
 * Optional in exactly the same way the model is optional: with no key there is
 * no voice, and that is a state the product reports rather than an error it
 * raises. Nothing upstream should ever have to catch anything from here.
 */

const ELEVENLABS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-speech';
const VOICES_ENDPOINT = 'https://api.elevenlabs.io/v1/voices';

/**
 * Nobody on the team has a voice picked, so when `ELEVENLABS_VOICE_ID` is
 * unset the account's own voice list is consulted once and the calmest
 * familiar name wins. The lookup is cached for the life of the process.
 */
const PREFERRED_VOICE_NAMES = ['Sarah', 'Rachel', 'Matilda', 'Alice', 'Lily', 'Aria', 'Laura'];
let resolvedVoice: { id: string; name: string } | null = null;

const MODEL_ID = 'eleven_turbo_v2_5';
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Agent replies are two to four sentences, so this ceiling is never reached in
 * normal use. It exists so a runaway input cannot turn into a long, expensive
 * render.
 */
const MAX_CHARS = 800;

export const VOICE_AUDIO_TYPE = 'audio/mpeg';

function apiKey(): string | undefined {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  return key ? key : undefined;
}

export function isVoiceEnabled(): boolean {
  return Boolean(apiKey());
}

interface VoiceListing {
  voices?: Array<{ voice_id: string; name: string; category?: string }>;
}

/**
 * The voice to speak with: the configured id, else one chosen from the
 * account. Returns `null` only when there is no key or the list could not be
 * fetched, in which case the agent simply stays silent.
 */
export async function resolveVoice(): Promise<{ id: string; name: string } | null> {
  const key = apiKey();
  if (!key) return null;

  const configured = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (configured) return { id: configured, name: 'configured' };
  if (resolvedVoice) return resolvedVoice;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(VOICES_ENDPOINT, {
      headers: { 'xi-api-key': key },
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[sidequest] could not list voices: HTTP ${response.status}`);
      return null;
    }
    const listing = (await response.json()) as VoiceListing;
    const voices = listing.voices ?? [];
    if (voices.length === 0) return null;

    // Library names carry descriptors ("Sarah - Mature, Reassuring"), so match
    // on the leading name rather than the whole string.
    const leading = (name: string) => name.split(/\s[-–—]\s/)[0].trim().toLowerCase();
    const preferred = PREFERRED_VOICE_NAMES.map((name) =>
      voices.find((v) => leading(v.name) === name.toLowerCase()),
    ).find(Boolean);
    const pick = preferred ?? voices.find((v) => v.category === 'premade') ?? voices[0];

    resolvedVoice = { id: pick.voice_id, name: pick.name };
    return resolvedVoice;
  } catch (error) {
    console.warn('[sidequest] could not list voices:', describe(error));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Cut on a sentence boundary where there is one, so speech never stops mid-word. */
function trim(text: string): string {
  const clean = text.trim();
  if (clean.length <= MAX_CHARS) return clean;

  const head = clean.slice(0, MAX_CHARS);
  const lastStop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('? '), head.lastIndexOf('! '));
  return lastStop > MAX_CHARS / 2 ? head.slice(0, lastStop + 1) : head;
}

function describe(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'timeout';
  if (error instanceof Error) return error.name;
  return 'unknown error';
}

/**
 * Render `text` to MP3. `null` means "no voice right now" — missing key, failed
 * request, or a timeout. The caller treats all three the same way.
 */
export async function synthesize(text: string): Promise<ArrayBuffer | null> {
  const key = apiKey();
  if (!key) return null;

  const spoken = trim(text);
  if (!spoken) return null;

  const voice = await resolveVoice();
  if (!voice) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${ELEVENLABS_ENDPOINT}/${encodeURIComponent(voice.id)}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: VOICE_AUDIO_TYPE,
        'xi-api-key': key,
      },
      body: JSON.stringify({
        text: spoken,
        model_id: MODEL_ID,
        voice_settings: {
          // Steady over expressive. The agent is talking about someone's week,
          // not performing it.
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[sidequest] voice unavailable, staying silent: HTTP ${response.status}`);
      return null;
    }

    const audio = await response.arrayBuffer();
    return audio.byteLength > 0 ? audio : null;
  } catch (error) {
    console.warn('[sidequest] voice unavailable, staying silent:', describe(error));
    return null;
  } finally {
    clearTimeout(timer);
  }
}
