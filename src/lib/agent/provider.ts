import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import type { ZodType } from 'zod';

/**
 * The only place the Anthropic SDK is touched.
 *
 * Every call here is optional by construction. No key, a timeout, a rate limit,
 * a malformed reply — all of them return `null`, and the caller falls back to
 * deterministic copy. The model writes sentences; it never decides anything, so
 * losing it degrades the wording and nothing else.
 */

const MODEL = 'claude-sonnet-5';

/**
 * A demo cannot wait on a hung request. Twelve seconds is generous for a few
 * hundred tokens and still short enough that a stall looks like a pause rather
 * than a hang.
 */
const REQUEST_TIMEOUT_MS = 12_000;

export function isLLMEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!client) {
    client = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  }
  return client;
}

/** Errors are summarised, never dumped — request objects carry the key. */
function describe(error: unknown): string {
  if (error instanceof Anthropic.APIError) return `${error.status ?? 'network'} ${error.name}`;
  if (error instanceof Error) return error.name;
  return 'unknown error';
}

export interface CompleteOptions {
  system: string;
  user: string;
  maxTokens?: number;
}

/** Plain text completion. `null` means "write it yourself". */
export async function complete({
  system,
  user,
  maxTokens = 600,
}: CompleteOptions): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();

    return text.length > 0 ? text : null;
  } catch (error) {
    console.warn('[sidequest] LLM unavailable, using deterministic copy:', describe(error));
    return null;
  }
}

/**
 * Pull the JSON value out of a reply that may be fenced or padded with prose.
 * Models are well-behaved about this most of the time; "most" is not a
 * guarantee we can build on, so the boundaries get found explicitly.
 */
function extractJSON(raw: string): string | null {
  const unfenced = raw.replace(/```(?:json)?/gi, '').trim();
  const firstObject = unfenced.indexOf('{');
  const firstArray = unfenced.indexOf('[');
  const start =
    firstObject === -1
      ? firstArray
      : firstArray === -1
        ? firstObject
        : Math.min(firstObject, firstArray);
  if (start === -1) return null;

  const closer = unfenced[start] === '{' ? '}' : ']';
  const end = unfenced.lastIndexOf(closer);
  if (end <= start) return null;

  return unfenced.slice(start, end + 1);
}

export interface CompleteJSONOptions<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
  maxTokens?: number;
}

/**
 * Structured completion. Returns `null` on a missing key, a failed request,
 * unparseable output, or output that does not satisfy `schema` — the caller
 * never has to reason about which of those happened.
 */
export async function completeJSON<T>({
  system,
  user,
  schema,
  maxTokens = 900,
}: CompleteJSONOptions<T>): Promise<T | null> {
  const raw = await complete({
    system: `${system}\n\nRespond with JSON only. No prose before or after it, no markdown fence.`,
    user,
    maxTokens,
  });
  if (!raw) return null;

  const candidate = extractJSON(raw);
  if (!candidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  const result = schema.safeParse(parsed);
  return result.success ? result.data : null;
}
