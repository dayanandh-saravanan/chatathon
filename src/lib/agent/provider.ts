import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import type { ZodType } from 'zod';

/**
 * The only place a model provider is touched.
 *
 * Three backends, tried in a fixed order: Gemini, then Anthropic, then nothing.
 * Every call is optional by construction. No key, a timeout, a rate limit, a
 * malformed reply — all of them return `null`, and the caller falls back to
 * deterministic copy. The model writes sentences; it never decides anything, so
 * losing it degrades the wording and nothing else.
 */

export type ProviderName = 'gemini' | 'anthropic' | 'none';

/**
 * Model id. `gemini-2.5-flash` is closed to new keys — the API returns 404 with
 * a pointer to 3.6 — so this is the current default, overridable per deploy.
 */
const GEMINI_MODEL = process.env.GOOGLE_GENAI_MODEL?.trim() || 'gemini-3.6-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Overridable without a code change, because model names outlive deploys. */
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-5';

/**
 * A demo cannot wait on a hung request. Twenty seconds is generous for a few
 * hundred tokens and still short enough that a stall looks like a pause rather
 * than a hang.
 */
/**
 * Short on purpose. A turn can make three model calls in a row (draft, plan,
 * narration); at twenty seconds each a bad minute at Gemini left the agent
 * "thinking" for longer than the demo. Nine seconds keeps the worst turn under
 * half a minute, and the deterministic planner covers whatever the model misses.
 */
const REQUEST_TIMEOUT_MS = 9_000;
/** After a timeout or 5xx, skip Gemini for this long rather than paying it again on every call. */
const GEMINI_COOLDOWN_MS = 60_000;
let geminiCooldownUntil = 0;

function geminiKey(): string | undefined {
  // GOOGLE_GENAI_API_KEY is the name we read first on purpose: some shells
  // export a literal, unexpanded `${GEMINI_API_KEY}` placeholder, which makes
  // dotenv-expand recurse and causes Next to silently discard all of
  // `.env.local`. Using a different name sidesteps that collision entirely.
  if (Date.now() < geminiCooldownUntil) return undefined;
  const raw = process.env.GOOGLE_GENAI_API_KEY ?? process.env.GEMINI_API_KEY;
  const key = raw?.trim();
  // Ignore an unexpanded shell placeholder rather than sending it upstream.
  if (key?.startsWith('${')) return undefined;
  return key ? key : undefined;
}

function anthropicKey(): string | undefined {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  return key ? key : undefined;
}

/** Which backend a call would actually reach right now. */
export function activeProvider(): ProviderName {
  if (geminiKey()) return 'gemini';
  if (anthropicKey()) return 'anthropic';
  return 'none';
}

export function isLLMEnabled(): boolean {
  return activeProvider() !== 'none';
}

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic | null {
  const apiKey = anthropicKey();
  if (!apiKey) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  }
  return anthropicClient;
}

/**
 * Errors are summarised, never dumped — request objects and URLs carry the key.
 * Nothing that reaches a log here has ever seen the secret.
 */
function describe(error: unknown): string {
  if (error instanceof Anthropic.APIError) return `${error.status ?? 'network'} ${error.name}`;
  if (error instanceof DOMException && error.name === 'AbortError') return 'timeout';
  if (error instanceof Error) return error.name;
  return 'unknown error';
}

function warn(provider: ProviderName, reason: string): void {
  console.warn(`[sidequest] ${provider} unavailable, falling back: ${reason}`);
}

export interface CompleteOptions {
  system: string;
  user: string;
  maxTokens?: number;
}

/** What the backends actually receive, once defaults are applied. */
interface Request {
  system: string;
  user: string;
  maxTokens: number;
  /** Structured call: ask for JSON natively and keep the sampling tight. */
  json: boolean;
}

/* -------------------------------------------------------------------------- */
/* Gemini                                                                      */
/* -------------------------------------------------------------------------- */

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
}

/**
 * Headroom for reasoning tokens.
 *
 * On the 2.5 models `maxOutputTokens` is a hard infrastructure cutoff that
 * thinking is billed against. If the model reasons for longer than the caller's
 * budget, the reply comes back empty with `finishReason: MAX_TOKENS` — a silent
 * failure that looks exactly like "no key". The prompts cap the answer at a few
 * sentences, so a large ceiling costs nothing and removes that failure.
 */
const GEMINI_THINKING_HEADROOM = 2_048;

/**
 * Whether the model is asked to stop reasoning.
 *
 * `thinkingBudget: 0` is not accepted by every 2.5 model, and an unsupported
 * value is a 400 rather than a warning. It is therefore sent as an attempt, not
 * an assumption: a 400 retries once without it. Worth the extra round trip in
 * the failure case, because quest drafting is the live AI beat on stage and the
 * alternative is falling through to fixed copy.
 */
type ThinkingMode = 'off' | 'default';

function geminiBody(request: Request, thinking: ThinkingMode): string {
  const { system, user, maxTokens, json } = request;
  return JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens: maxTokens + GEMINI_THINKING_HEADROOM,
      // Prose wants a little room; a milestone ladder wants to be correct.
      temperature: json ? 0.35 : 0.7,
      // Native JSON mode removes the fence-and-preamble failure entirely.
      ...(json ? { responseMimeType: 'application/json' } : {}),
      ...(thinking === 'off' ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  });
}

/**
 * `rejected` means the request shape itself came back a 400, which is the one
 * failure worth a second attempt with the optional reasoning control dropped.
 */
type Attempt = { text: string } | { text: null; rejected: boolean };

/**
 * Plain `fetch`, no SDK. The key travels in a header rather than the query
 * string so it never lands in a proxy or error-message URL.
 */
async function geminiAttempt(
  apiKey: string,
  request: Request,
  thinking: ThinkingMode,
): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: geminiBody(request, thinking),
      signal: controller.signal,
    });

    if (!response.ok) {
      // A 400 covers both a rejected field and a rejected key. Only the first
      // attempt treats it as retryable; the second one reports it.
      const rejected = response.status === 400;
      if (!rejected || thinking === 'default') {
        warn('gemini', `HTTP ${response.status}`);
      }
      if (response.status >= 500 || response.status === 429) {
        geminiCooldownUntil = Date.now() + GEMINI_COOLDOWN_MS;
      }
      return { text: null, rejected };
    }

    const body = (await response.json()) as GeminiResponse;
    const candidate = body.candidates?.[0];
    const text = (candidate?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')
      .trim();

    if (text.length === 0) {
      warn('gemini', `empty completion (${candidate?.finishReason ?? 'no candidate'})`);
      return { text: null, rejected: false };
    }

    return { text };
  } catch (error) {
    const reason = describe(error);
    warn('gemini', reason);
    if (reason === 'timeout') geminiCooldownUntil = Date.now() + GEMINI_COOLDOWN_MS;
    return { text: null, rejected: false };
  } finally {
    clearTimeout(timer);
  }
}

async function completeWithGemini(apiKey: string, request: Request): Promise<string | null> {
  const first = await geminiAttempt(apiKey, request, 'off');
  if (first.text !== null) return first.text;
  if (!first.rejected) return null;

  const second = await geminiAttempt(apiKey, request, 'default');
  return second.text;
}

/* -------------------------------------------------------------------------- */
/* Anthropic                                                                   */
/* -------------------------------------------------------------------------- */

async function completeWithAnthropic(
  client: Anthropic,
  { system, user, maxTokens, json }: Request,
): Promise<string | null> {
  try {
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature: json ? 0.35 : 0.7,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();

    return text.length > 0 ? text : null;
  } catch (error) {
    warn('anthropic', describe(error));
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Public surface                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The backends that could answer this process, in order. Gemini stays ahead of
 * Anthropic even when both are configured, so a bad key or a rate limit on the
 * first one degrades to the second rather than straight to fixed copy.
 */
function backends(request: Request): Array<() => Promise<string | null>> {
  const chain: Array<() => Promise<string | null>> = [];

  const gemini = geminiKey();
  if (gemini) chain.push(() => completeWithGemini(gemini, request));

  const anthropic = getAnthropic();
  if (anthropic) chain.push(() => completeWithAnthropic(anthropic, request));

  return chain;
}

/** Plain text completion. `null` means "write it yourself". */
export async function complete({
  system,
  user,
  maxTokens = 600,
}: CompleteOptions): Promise<string | null> {
  for (const attempt of backends({ system, user, maxTokens, json: false })) {
    const text = await attempt();
    if (text) return text;
  }
  return null;
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

function parseAgainst<T>(raw: string, schema: ZodType<T>): T | null {
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
 *
 * Output that parses but fails the schema is treated exactly like a failed
 * request: the next backend gets a turn. A reply in the wrong shape is no more
 * usable than no reply, so it should not be the thing that ends the chain.
 */
export async function completeJSON<T>({
  system,
  user,
  schema,
  maxTokens = 900,
}: CompleteJSONOptions<T>): Promise<T | null> {
  const request: Request = {
    system: `${system}\n\nRespond with JSON only. No prose before or after it, no markdown fence.`,
    user,
    maxTokens,
    json: true,
  };

  for (const attempt of backends(request)) {
    const raw = await attempt();
    if (!raw) continue;

    const value = parseAgainst(raw, schema);
    if (value !== null) return value;
  }

  return null;
}
